type EnvironmentVariables = {
  [key: string]: string;
};

type FunctionOutputInputValues = {
  [key: string]: unknown;
};

export type InvocationPayload<Body extends ValidInvocationPayloadBody> = {
  body: Body;
  context: {
    bot_access_token: string;
    variables: EnvironmentVariables;
  };
};

export type ValidInvocationPayloadBody =
  | BlockActionInvocationBody
  | ViewSubmissionInvocationBody
  | FunctionInvocationBody;

export type FunctionInvocationBody = {
  event: {
    type: "function_executed";
    function: {
      callback_id: string;
    };
    function_execution_id: string;
    inputs: FunctionOutputInputValues;
  };
};

// TODO: type this to account for variable return options?
export type FunctionHandlerReturnArgs = {
  completed?: boolean;
  outputs?: FunctionOutputInputValues;
  error?: string;
};

export type FunctionContext = {
  env: EnvironmentVariables;
  inputs: FunctionOutputInputValues;
  token: string;
  event: FunctionInvocationBody["event"];
};

export type AsyncFunctionHandler = {
  (context: FunctionContext): Promise<FunctionHandlerReturnArgs>;
};

export type SyncFunctionHandler = {
  (context: FunctionContext): FunctionHandlerReturnArgs;
};

export type FunctionHandler = AsyncFunctionHandler | SyncFunctionHandler;

// --- Block Actions Types -- //
// TODO: expand the type here
type BlockAction = {
  type: string;
  "action_id": string;
  "block_id": string;
  "action_ts": string;
  value?: string;
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
};
export type BlockActionInvocationBody = {
  type: "block_actions";
  actions: BlockAction[];
  "trigger_id": string;
  "response_url": string;
  user: {
    id: string;
    username: string;
    name: string;
    "team_id": string;
  };
  state?: {
    // deno-lint-ignore no-explicit-any
    values: any;
  };
  view?: {
    state?: {
      // deno-lint-ignore no-explicit-any
      values: any;
    };
  };
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
};

export type BlockActionsHandlerArgs = {
  action: BlockAction;
  body: BlockActionInvocationBody;
  token: string;
  env: EnvironmentVariables;
};

export type AsyncBlockActionsHandler = {
  // deno-lint-ignore no-explicit-any
  (args: BlockActionsHandlerArgs): Promise<any>;
};

export type SyncBlockActionsHandler = {
  // deno-lint-ignore no-explicit-any
  (args: BlockActionsHandlerArgs): any;
};

export type BlockActionsHandler =
  | AsyncBlockActionsHandler
  | SyncBlockActionsHandler;

// TODO: expand the type here
// --- View Submission Types --- //
export type ViewSubmissionInvocationBody = {
  type: "view_submission";
  view: {
    "callback_id": string;
    // deno-lint-ignore no-explicit-any
    [key: string]: any;
  };
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
};

type ViewSubmissionHandlerArgs = {
  body: ViewSubmissionInvocationBody;
  token: string;
  env: EnvironmentVariables;
};

type AsyncViewSubmissionHandler = {
  // deno-lint-ignore no-explicit-any
  (args: ViewSubmissionHandlerArgs): Promise<any>;
};

type SyncViewSubmissionHandler = {
  // deno-lint-ignore no-explicit-any
  (args: ViewSubmissionHandlerArgs): any;
};

type ViewSubmissionHandler =
  | AsyncViewSubmissionHandler
  | SyncViewSubmissionHandler;

// This is the interface a developer-provided function module should adhere to
export type FunctionModule = {
  default: FunctionHandler;
  actions?: BlockActionsHandler;
  viewSubmissions?: ViewSubmissionHandler;
  //TODO: add support for an `actions()` handler block_actions could route too
  // In order to do this, block_actions would need to include the function callback_id
};

export type BaseResponse = {
  /** `true` if the response from the server was successful, `false` otherwise. */
  ok: boolean;
  /** Optional error description returned by the server. */
  error?: string;
  /** Optional list of warnings returned by the server. */
  warnings?: string[];
  /** Optional metadata about the response returned by the server. */
  response_metadata?: {
    warnings?: string[];
    messages?: string[];
  };
  [otherOptions: string]: unknown;
};

export interface ISlackAPIClient {
  /**
   * Calls a Slack API method.
   * @param {string} method The API method name to invoke, i.e. `chat.postMessage`.
   * @param {Object} data Object representing the data you wish to send along to the Slack API method.
   * @returns {Promise<BaseResponse>} A Promise that resolves to the data the API responded with.
   * @throws {Error} Throws an Error if the API response was not OK or a network error occurred.
   */
  call(method: string, data: { [key: string]: unknown }): Promise<BaseResponse>;
}

export const EventTypes = {
  FUNCTION_EXECUTED: "function_executed",
  BLOCK_ACTIONS: "block_actions",
  VIEW_SUBMISSION: "view_submission",
} as const;

export type ValidEventType = typeof EventTypes[keyof typeof EventTypes];
