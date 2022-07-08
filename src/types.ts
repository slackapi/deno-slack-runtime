type EnvironmentVariables = {
  [key: string]: string;
};

type FunctionInputValues = {
  [key: string]: unknown;
};
type FunctionOutputValues = FunctionInputValues;

export type InvocationPayload<Body extends ValidInvocationPayloadBody> = {
  body: Body;
  context: {
    bot_access_token: string;
    variables: EnvironmentVariables;
  };
};

export type ValidInvocationPayloadBody =
  | BlockActionInvocationBody
  | FunctionInvocationBody;

// Invocation Bodies
export type FunctionInvocationBody = {
  event: {
    type: "function_executed";
    function: {
      callback_id: string;
    };
    function_execution_id: string;
    inputs: FunctionInputValues;
    bot_access_token?: string;
  };
};

export type BlockActionInvocationBody = {
  type: "block_actions";
  actions: BlockAction[];
  bot_access_token?: string;
  function_data?: FunctionData;
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
};

type FunctionData = {
  function: {
    callback_id: string;
  };
  execution_id: string;
  inputs: FunctionInputValues;
};

// TODO: type this to account for variable return options?
export type FunctionHandlerReturnArgs = {
  completed?: boolean;
  outputs?: FunctionOutputValues;
  error?: string;
};

export type FunctionHandlerArgs = {
  env: EnvironmentVariables;
  inputs: FunctionInputValues;
  token: string;
  event: FunctionInvocationBody["event"];
};

export type FunctionHandler = {
  (
    args: FunctionHandlerArgs,
  ): Promise<FunctionHandlerReturnArgs> | FunctionHandlerReturnArgs;
};

// This is the interface a developer-provided function module should adhere to
export type FunctionModule = {
  default: FunctionHandler;
  blockActions?: BlockActionsHandler;
};

export const EventTypes = {
  FUNCTION_EXECUTED: "function_executed",
  BLOCK_ACTIONS: "block_actions",
} as const;

export type ValidEventType = typeof EventTypes[keyof typeof EventTypes];

// --- Block Actions Types -- //
// deno-lint-ignore no-explicit-any
type BlockAction = any;

export type BlockActionsHandlerArgs = {
  action: BlockAction;
  body: BlockActionInvocationBody;
  token: string;
  inputs: FunctionInputValues;
  env: EnvironmentVariables;
};

export type BlockActionsHandler = {
  // deno-lint-ignore no-explicit-any
  (args: BlockActionsHandlerArgs): Promise<any> | any;
};
