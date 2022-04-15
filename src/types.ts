type EnvironmentVariables = {
  [key: string]: string;
};

type FunctionOutputInputValues = {
  [key: string]: unknown;
};

export type InvocationPayload<Body> = {
  body: Body;
  context: {
    bot_access_token: string;
    variables: EnvironmentVariables;
  };
};

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

// This is the interface a developer-provided function module should adhere to
export type FunctionModule = {
  default: FunctionHandler;
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
