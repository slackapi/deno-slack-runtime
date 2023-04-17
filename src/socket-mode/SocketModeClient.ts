import {
  BaseSlackAPIClient,
  Configuration,
  Context,
  EventEmitter,
  setImmediate,
  StateMachine,
} from "../deps.ts";
import Finity from "npm:finity@^0.5.4";
import {
  sendWhileDisconnectedError,
  sendWhileNotReadyError,
  UnrecoverableSocketModeStartError,
  websocketErrorWithOriginal,
} from "./errors.ts";
import { SocketModeOptions } from "./SocketModeOptions.ts";

export interface WebAPICallResult {
  ok: boolean;
  error?: string;
  response_metadata?: {
    warnings?: string[];
    next_cursor?: string; // is this too specific to be encoded into this type?

    // added from the headers of the http response
    scopes?: string[];
    acceptedScopes?: string[];
    retryAfter?: number;
    // `chat.postMessage` returns an array of error messages (e.g., "messages": ["[ERROR] invalid_keys"])
    messages?: string[];
  };
  [key: string]: unknown;
}

export type AppsConnectionsOpenResponse = WebAPICallResult & {
  error?: string;
  needed?: string;
  ok?: boolean;
  provided?: string;
  url?: string;
};

export declare enum ErrorCode {
  RequestError = "slack_webapi_request_error",
  HTTPError = "slack_webapi_http_error",
  PlatformError = "slack_webapi_platform_error",
  RateLimitedError = "slack_webapi_rate_limited_error",
}

// These enum values are used only in the state machine
enum State {
  Connecting = "connecting",
  Connected = "connected",
  Reconnecting = "reconnecting",
  Disconnecting = "disconnecting",
  Disconnected = "disconnected",
  Failed = "failed",
}
enum ConnectingState {
  Handshaking = "handshaking",
  Authenticating = "authenticating",
  Authenticated = "authenticated",
  Reconnecting = "reconnecting",
  Failed = "failed",
}
enum ConnectedState {
  Preparing = "preparing",
  Ready = "ready",
  Failed = "failed",
}

// These enum values are used only in the state machine
enum Event {
  Start = "start",
  Failure = "failure",
  WebSocketOpen = "websocket open",
  WebSocketClose = "websocket close",
  ServerHello = "server hello",
  ServerDisconnectWarning = "server disconnect warning",
  ServerDisconnectOldSocket = "server disconnect old socket",
  ServerPingsNotReceived = "server pings not received",
  ServerPongsNotReceived = "server pongs not received",
  ExplicitDisconnect = "explicit disconnect",
  UnableToSocketModeStart = "unable_to_socket_mode_start",
}

/**
 * An Socket Mode Client allows programs to communicate with the
 * [Slack Platform's Events API](https://api.slack.com/events-api) over WebSocket connections.
 * This object uses the EventEmitter pattern to dispatch incoming events
 * and has a built in send method to acknowledge incoming events over the WebSocket connection.
 */
export class SocketModeClient extends EventEmitter {
  /**
   * Whether or not the client is currently connected to the web socket
   */
  public connected: boolean = false;

  /**
   * Whether or not the client has authenticated to the Socket Mode API.
   * This occurs when the connect method completes,
   * and a WebSocket URL is available for the client's connection.
   */
  public authenticated: boolean = false;

  /**
   * Returns true if the underlying WebSocket connection is active.
   */
  public isActive(): boolean {
    console.debug(
      `Details of isActive() response (connected: ${this.connected}, authenticated: ${this.authenticated}, badConnection: ${this.badConnection})`,
    );
    return this.connected && this.authenticated && !this.badConnection;
  }

  /**
   * The underlying WebSocket client instance
   */
  public websocket?: WebSocket;

  public constructor({
    autoReconnectEnabled = true,
    clientPingTimeout = 5000,
    appToken = undefined,
  }: SocketModeOptions = {}) {
    super();
    if (appToken === undefined) {
      throw new Error(
        "Must provide an App-Level Token when initializing a Socket Mode Client",
      );
    }
    this.clientPingTimeoutMillis = clientPingTimeout;
    this.webClient = new BaseSlackAPIClient(appToken);

    this.autoReconnectEnabled = autoReconnectEnabled;
    this.stateMachine = Finity.start(this.stateMachineConfig);
    console.debug("The Socket Mode client is successfully initialized");
  }

  /**
   * Start a Socket Mode session app.
   * It may take a few milliseconds before being connected.
   * This method must be called before any messages can be sent or received.
   */
  public start(): Promise<AppsConnectionsOpenResponse> {
    console.debug("Starting a Socket Mode client ...");
    // Delegate behavior to state machine
    this.stateMachine.handle(Event.Start);
    // Return a promise that resolves with the connection information
    return new Promise((resolve, reject) => {
      this.once(ConnectingState.Authenticated, (result) => {
        this.removeListener(State.Disconnected, reject);
        resolve(result);
      });
      this.once(State.Disconnected, (err) => {
        this.removeListener(ConnectingState.Authenticated, resolve);
        reject(err);
      });
    });
  }

  /**
   * End a Socket Mode session. After this method is called no messages will be sent or received
   * unless you call start() again later.
   */
  public disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.debug("Manually disconnecting this Socket Mode client");
      // Resolve (or reject) on disconnect
      this.once(State.Disconnected, (err) => {
        if (err instanceof Error) {
          reject(err);
        } else {
          resolve();
        }
      });
      // Delegate behavior to state machine
      this.stateMachine.handle(Event.ExplicitDisconnect);
    });
  }

  // --------------------------------------------
  // Private methods / properties
  // --------------------------------------------

  /**
   * State machine that backs the transition and action behavior
   */
  private stateMachine: StateMachine<State, Event>;

  /**
   * Internal count for managing the reconnection state
   */
  private numOfConsecutiveReconnectionFailures: number = 0;

  /* eslint-disable @typescript-eslint/indent, newline-per-chained-call */
  private connectingStateMachineConfig: Configuration<ConnectingState, Event> =
    Finity.configure<ConnectingState, Event>()
      .global()
      .onStateEnter((state) => {
        console.debug(
          `Transitioning to state: ${State.Connecting}:${state}`,
        );
      })
      .initialState(ConnectingState.Authenticating)
      .do(this.retrieveWSSURL.bind(this))
      .onSuccess().transitionTo(ConnectingState.Authenticated)
      .onFailure()
      .transitionTo(ConnectingState.Reconnecting).withCondition(
        this.reconnectingCondition.bind(this),
      )
      .transitionTo(ConnectingState.Failed)
      .state(ConnectingState.Reconnecting)
      .do(async () => {
        // Trying to reconnect after waiting for a bit...
        this.numOfConsecutiveReconnectionFailures += 1;
        const millisBeforeRetry = this.clientPingTimeoutMillis *
          this.numOfConsecutiveReconnectionFailures;
        console.debug(
          `Before trying to reconnect, this client will wait for ${millisBeforeRetry} milliseconds`,
        );
        setTimeout(() => {
          this.emit(ConnectingState.Authenticating);
        }, millisBeforeRetry);
      })
      .onFailure().transitionTo(ConnectingState.Failed)
      .state(ConnectingState.Authenticated)
      .onEnter(this.configureAuthenticatedWebSocket.bind(this))
      .on(Event.WebSocketOpen).transitionTo(ConnectingState.Handshaking)
      .state(ConnectingState.Handshaking) // a state in which to wait until the Event.ServerHello event
      .state(ConnectingState.Failed)
      .onEnter(this.handleConnectionFailure.bind(this))
      .getConfig();

  private connectedStateMachineConfig: Configuration<ConnectedState, Event> =
    Finity.configure<ConnectedState, Event>()
      .global()
      .onStateEnter((state) => {
        console.debug(
          `Transitioning to state: ${State.Connected}:${state}`,
        );
      })
      .initialState(ConnectedState.Preparing)
      .do(async () => {
        if (this.isSwitchingConnection) {
          this.switchWebSocketConnection();
          this.badConnection = false;
        }
      })
      .onSuccess().transitionTo(ConnectedState.Ready)
      .onFailure().transitionTo(ConnectedState.Failed)
      .state(ConnectedState.Failed)
      .onEnter(this.handleConnectionFailure.bind(this))
      .getConfig();

  /**
   * Configuration for the state machine
   */
  private stateMachineConfig: Configuration<State, Event> = Finity.configure<
    State,
    Event
  >()
    .global()
    .onStateEnter((state, context) => {
      console.debug(`Transitioning to state: ${state}`);
      if (state === State.Disconnected) {
        // Emits a `disconnected` event with a possible error object (might be undefined)
        this.emit(state, context.eventPayload);
      } else {
        // Emits events: `connecting`, `connected`, `disconnecting`, `reconnecting`
        this.emit(state);
      }
    })
    .initialState(State.Disconnected)
    .on(Event.Start)
    .transitionTo(State.Connecting)
    .state(State.Connecting)
    .onEnter(() => {
      console.info("Going to establish a new connection to Slack ...");
    })
    .submachine(this.connectingStateMachineConfig)
    .on(Event.ServerHello)
    .transitionTo(State.Connected)
    .on(Event.WebSocketClose)
    .transitionTo(State.Reconnecting).withCondition(
      this.autoReconnectCondition.bind(this),
    )
    .transitionTo(State.Disconnecting)
    .on(Event.ExplicitDisconnect)
    .transitionTo(State.Disconnecting)
    .on(Event.Failure)
    .transitionTo(State.Disconnected)
    .on(Event.WebSocketOpen)
    // If submachine not `authenticated` ignore event
    .ignore()
    .state(State.Connected)
    .onEnter(() => {
      this.connected = true;
      console.info("Now connected to Slack");
    })
    .submachine(this.connectedStateMachineConfig)
    .on(Event.WebSocketClose)
    .transitionTo(State.Reconnecting)
    .withCondition(this.autoReconnectCondition.bind(this))
    .withAction(() => this.markCurrentWebSocketAsInactive())
    .transitionTo(State.Disconnecting)
    .on(Event.ExplicitDisconnect)
    .transitionTo(State.Disconnecting)
    .withAction(() => this.markCurrentWebSocketAsInactive())
    .on(Event.ServerPingsNotReceived)
    .transitionTo(State.Reconnecting).withCondition(
      this.autoReconnectCondition.bind(this),
    )
    .transitionTo(State.Disconnecting)
    .on(Event.ServerPongsNotReceived)
    .transitionTo(State.Reconnecting).withCondition(
      this.autoReconnectCondition.bind(this),
    )
    .transitionTo(State.Disconnecting)
    .on(Event.ServerDisconnectWarning)
    .transitionTo(State.Reconnecting).withCondition(
      this.autoReconnectCondition.bind(this),
    )
    .transitionTo(State.Disconnecting)
    .on(Event.ServerDisconnectOldSocket)
    .transitionTo(State.Reconnecting).withCondition(
      this.autoReconnectCondition.bind(this),
    )
    .transitionTo(State.Disconnecting)
    .onExit()
    .state(State.Reconnecting)
    .onEnter(() => {
      console.info("Reconnecting to Slack ...");
    })
    .do(async () => {
      this.isSwitchingConnection = true;
    })
    .onSuccess().transitionTo(State.Connecting)
    .onFailure().transitionTo(State.Failed)
    .state(State.Disconnecting)
    .onEnter(() => {
      console.info("Disconnecting ...");
    })
    .do(async () => {
      this.terminateAllConnections();
      console.info("Disconnected from Slack");
    })
    .onSuccess().transitionTo(State.Disconnected)
    .onFailure().transitionTo(State.Failed)
    .getConfig();

  /* eslint-enable @typescript-eslint/indent, newline-per-chained-call */

  /**
   * Whether this client will automatically reconnect when (not manually) disconnected
   */
  private autoReconnectEnabled: boolean;

  private secondaryWebsocket?: WebSocket;

  private webClient: BaseSlackAPIClient;

  /**
   * How long to wait for pings from server before timing out
   */
  private clientPingTimeoutMillis: number;

  /**
   * Used to see if a WebSocket stops sending heartbeats and is deemed bad
   */
  private badConnection: boolean = false;

  /**
   * This flag can be true when this client is switching to a new connection.
   */
  private isSwitchingConnection: boolean = false;

  /**
   * Method for sending an outgoing message of an arbitrary type over the WebSocket connection.
   * Primarily used to send acknowledgements back to slack for incoming events
   * @param id the envelope id
   * @param body the message body or string text
   */
  private send(id: string, body = {}): Promise<void> {
    const _body = typeof body === "string" ? { text: body } : body;
    const message = { envelope_id: id, payload: { ..._body } };

    return new Promise((resolve, reject) => {
      console.debug(
        `send() method was called in state: ${this.stateMachine.getCurrentState()}, state hierarchy: ${this.stateMachine.getStateHierarchy()}`,
      );
      if (this.websocket === undefined) {
        console.error(
          "Failed to send a message as the client is not connected",
        );
        reject(sendWhileDisconnectedError());
      } else if (!this.isConnectionReady()) {
        console.error(
          "Failed to send a message as the client is not ready",
        );
        reject(sendWhileNotReadyError());
      } else {
        this.emit("outgoing_message", message);

        const flatMessage = JSON.stringify(message);
        console.debug(`Sending a WebSocket message: ${flatMessage}`);
        this.websocket.send(flatMessage);
      }
    });
  }

  private async retrieveWSSURL(): Promise<AppsConnectionsOpenResponse> {
    try {
      console.debug("Going to retrieve a new WSS URL ...");
      return await this.webClient.apiCall("apps.connections.open", {});
    } catch (error) {
      console.error(
        `Failed to retrieve a new WSS URL for reconnection (error: ${error})`,
      );
      throw error;
    }
  }

  private autoReconnectCondition(): boolean {
    return this.autoReconnectEnabled;
  }

  private reconnectingCondition(context: Context<string, string>): boolean {
    const error = context.error as any;
    console.warn(
      `Failed to start a Socket Mode connection (error: ${error.message})`,
    );

    // Observe this event when the error which causes reconnecting or disconnecting is meaningful
    this.emit(Event.UnableToSocketModeStart, error);
    let isRecoverable = true;
    if (
      error.code === ErrorCode.PlatformError &&
      (Object.values(UnrecoverableSocketModeStartError) as string[]).includes(
        error.data.error,
      )
    ) {
      isRecoverable = false;
    } else if (error.code === ErrorCode.RequestError) {
      isRecoverable = false;
    } else if (error.code === ErrorCode.HTTPError) {
      isRecoverable = false;
    }
    return this.autoReconnectEnabled && isRecoverable;
  }

  private configureAuthenticatedWebSocket(
    _state: string,
    context: Context<string, string>,
  ) {
    this.numOfConsecutiveReconnectionFailures = 0; // Reset the failure count
    this.authenticated = true;
    this.setupWebSocket(context.result.url);
    setImmediate(() => {
      this.emit(ConnectingState.Authenticated, context.result);
    });
  }

  private handleConnectionFailure(
    _state: string,
    context: Context<string, string>,
  ) {
    console.error(
      `The internal logic unexpectedly failed (error: ${context.error})`,
    );
    this.terminateAllConnections();
    // dispatch 'failure' on parent machine to transition out of this submachine's states
    this.stateMachine.handle(Event.Failure, context.error);
  }

  private markCurrentWebSocketAsInactive(): void {
    this.badConnection = true;
    this.connected = false;
    this.authenticated = false;
  }

  /**
   * Clean up all the remaining connections.
   */
  private terminateAllConnections() {
    if (this.secondaryWebsocket !== undefined) {
      this.terminateWebSocketSafely(this.secondaryWebsocket);
      this.secondaryWebsocket = undefined;
    }
    if (this.websocket !== undefined) {
      this.terminateWebSocketSafely(this.websocket);
      this.websocket = undefined;
    }
  }

  /**
   * Set up method for the client's WebSocket instance. This method will attach event listeners.
   */
  private setupWebSocket(url: string): void {
    // initialize the websocket
    let websocket: WebSocket;
    if (this.websocket === undefined) {
      this.websocket = new WebSocket(url);
      websocket = this.websocket;
    } else {
      // Set up secondary websocket
      // This is used when creating a new connection because the first is about to disconnect
      this.secondaryWebsocket = new WebSocket(url);
      websocket = this.secondaryWebsocket;
    }

    // Attach event listeners
    websocket.onopen = (event) => {
      this.stateMachine.handle(Event.WebSocketOpen, event);
    };
    websocket.onclose = (event) => {
      this.stateMachine.handle(Event.WebSocketClose, event);
    };

    websocket.onerror = (event: globalThis.Event | ErrorEvent) => {
      console.error(`A WebSocket error occurred: ${event}`);
      if (event instanceof ErrorEvent) {
        this.emit("error", websocketErrorWithOriginal(event));
      }
    };
    websocket.onmessage = this.onWebSocketMessage.bind(this);
  }

  /**
   * Switch the active connection to the secondary if exists.
   */
  private switchWebSocketConnection(): void {
    if (this.secondaryWebsocket !== undefined && this.websocket !== undefined) {
      console.debug("Switching to the secondary connection ...");
      // Currently have two WebSocket objects, so tear down the older one
      const oldWebsocket = this.websocket;
      // Switch to the new one here
      this.websocket = this.secondaryWebsocket;
      this.secondaryWebsocket = undefined;
      console.debug("Switched to the secondary connection");
      // Swithcing the connection is done
      this.isSwitchingConnection = false;

      // Clean up the old one
      this.terminateWebSocketSafely(oldWebsocket);
      console.debug("Terminated the old connection");
    }
  }

  /**
   * Tear down method for the client's WebSocket instance.
   * This method undoes the work in setupWebSocket(url).
   */
  private terminateWebSocketSafely(websocket: WebSocket): void {
    if (websocket !== undefined) {
      try {
        websocket.close();
      } catch (e) {
        console.error(`Failed to terminate a connection (error: ${e})`);
      }
    }
  }

  private isConnectionReady() {
    const currentState = this.stateMachine.getCurrentState();
    const stateHierarchy = this.stateMachine.getStateHierarchy();
    return currentState === State.Connected &&
      stateHierarchy !== undefined &&
      stateHierarchy.length >= 2 &&
      // When the primary state is State.Connected, the second one is always set by the sub state machine
      stateHierarchy[1].toString() === ConnectedState.Ready;
  }

  /**
   * `onmessage` handler for the client's WebSocket.
   * This will parse the payload and dispatch the relevant events for each incoming message.
   */
  protected onWebSocketMessage(
    { data }: { data: string },
  ): void {
    console.debug(`Received a message on the WebSocket: ${data}`);

    // Parse message into slack event
    let event: {
      type: string;
      reason: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: { [key: string]: any };
      envelope_id: string;
      retry_attempt?: number; // type: events_api
      retry_reason?: string; // type: events_api
      accepts_response_payload?: boolean; // type: events_api, slash_commands, interactive
    };

    try {
      event = JSON.parse(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (parseError: any) {
      // Prevent application from crashing on a bad message, but log an error to bring attention
      console.error(
        `Unable to parse an incoming WebSocket message: ${parseError.message}`,
      );
      return;
    }

    // Internal event handlers
    if (event.type === "hello") {
      this.stateMachine.handle(Event.ServerHello);
      return;
    }

    // Open the second WebSocket connection in preparation for the existing WebSocket disconnecting
    if (event.type === "disconnect" && event.reason === "warning") {
      console.debug(
        'Received "disconnect" (warning) message - creating the second connection',
      );
      this.stateMachine.handle(Event.ServerDisconnectWarning);
      return;
    }

    // Close the primary WebSocket in favor of secondary WebSocket, assign secondary to primary
    if (event.type === "disconnect" && event.reason === "refresh_requested") {
      console.debug(
        'Received "disconnect" (refresh requested) message - closing the old WebSocket connection',
      );
      this.stateMachine.handle(Event.ServerDisconnectOldSocket);
      return;
    }

    // Define Ack
    const ack = async (response: Record<string, unknown>): Promise<void> => {
      console.debug(
        `Calling ack() - type: ${event.type}, envelope_id: ${event.envelope_id}, data: ${response}`,
      );
      await this.send(event.envelope_id, response);
    };

    // For events_api messages, expose the type of the event
    if (event.type === "events_api") {
      this.emit(event.payload.event.type, {
        ack,
        envelope_id: event.envelope_id,
        body: event.payload,
        event: event.payload.event,
        retry_num: event.retry_attempt,
        retry_reason: event.retry_reason,
        accepts_response_payload: event.accepts_response_payload,
      });
    } else {
      // Emit just ack and body for all other types of messages
      this.emit(event.type, {
        ack,
        envelope_id: event.envelope_id,
        body: event.payload,
        accepts_response_payload: event.accepts_response_payload,
      });
    }

    // Emitter for all slack events
    // (this can be used in tools like bolt-js)
    this.emit("slack_event", {
      ack,
      envelope_id: event.envelope_id,
      type: event.type,
      body: event.payload,
      retry_num: event.retry_attempt,
      retry_reason: event.retry_reason,
      accepts_response_payload: event.accepts_response_payload,
    });
  }
}

export default SocketModeClient;
