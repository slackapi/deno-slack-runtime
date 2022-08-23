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
    team_id: string;
    variables: EnvironmentVariables;
  };
};

export type ValidInvocationPayloadBody =
  | BlockActionInvocationBody
  | ViewSubmissionInvocationBody
  | ViewClosedInvocationBody
  | FunctionInvocationBody
  | BaseEventInvocationBody;

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

// All events other than the main function_executed one have at least these properties
export type BaseEventInvocationBody = {
  bot_access_token?: string;
  function_data?: FunctionData;
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
};

export type BlockActionInvocationBody = BaseEventInvocationBody & {
  type: "block_actions";
  actions: BlockAction[];
};

export type ViewClosedInvocationBody = BaseEventInvocationBody & {
  type: "view_closed";
  view: View;
};

export type ViewSubmissionInvocationBody = BaseEventInvocationBody & {
  type: "view_submission";
  view: View;
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
  team_id: string;
  event: FunctionInvocationBody["event"];
};

export type FunctionHandler = {
  (
    args: FunctionHandlerArgs,
  ): Promise<FunctionHandlerReturnArgs> | FunctionHandlerReturnArgs;
};

type FunctionHandlers = {
  blockActions?: BlockActionsHandler;
  viewSubmission?: ViewSubmissionHandler;
  viewClosed?: ViewClosedHandler;
  unhandledEvent?: UnhandledEventHandler;
};

type MainFunctionHandler = FunctionHandler & FunctionHandlers;

// This is the interface a developer-provided function module should adhere to
export type FunctionModule =
  | ({
    default: MainFunctionHandler;
  } & FunctionHandlers)
  | // Allows for a function module w/ only a single unhandledEvent handler
  ({
    default?: MainFunctionHandler;
    unhandledEvent: UnhandledEventHandler;
  } & Omit<FunctionHandlers, "unhandledEvent">);

export const EventTypes = {
  FUNCTION_EXECUTED: "function_executed",
  BLOCK_ACTIONS: "block_actions",
  VIEW_SUBMISSION: "view_submission",
  VIEW_CLOSED: "view_closed",
} as const;

export type ValidEventType = typeof EventTypes[keyof typeof EventTypes];

// --- Unhandled Event Types --- //
type UnhandledEventHandlerArgs = {
  body: BaseEventInvocationBody;
  token: string;
  team_id: string;
  inputs: FunctionInputValues;
  env: EnvironmentVariables;
};

type UnhandledEventHandler = {
  // deno-lint-ignore no-explicit-any
  (args: UnhandledEventHandlerArgs): Promise<any> | any;
};

// --- Block Actions Types -- //
// deno-lint-ignore no-explicit-any
type BlockAction = any;

export type BlockActionsHandlerArgs = {
  action: BlockAction;
  body: BlockActionInvocationBody;
  token: string;
  team_id: string;
  inputs: FunctionInputValues;
  env: EnvironmentVariables;
};

export type BlockActionsHandler = {
  // deno-lint-ignore no-explicit-any
  (args: BlockActionsHandlerArgs): Promise<any> | any;
};

// --- View Closed Types --- //
// deno-lint-ignore no-explicit-any
type View = any;

type ViewClosedHandlerArgs = {
  view: View;
  body: ViewClosedInvocationBody;
  token: string;
  team_id: string;
  inputs: FunctionInputValues;
  env: EnvironmentVariables;
};

type ViewClosedHandler = {
  // deno-lint-ignore no-explicit-any
  (args: ViewClosedHandlerArgs): Promise<any> | any;
};

// --- View Submission Types --- //
type ViewSubmissionHandlerArgs = {
  view: View;
  body: ViewSubmissionInvocationBody;
  token: string;
  team_id: string;
  inputs: FunctionInputValues;
  env: EnvironmentVariables;
};

type ViewSubmissionHandler = {
  // deno-lint-ignore no-explicit-any
  (args: ViewSubmissionHandlerArgs): Promise<any> | any;
};
