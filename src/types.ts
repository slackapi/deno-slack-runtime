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
  | BlockSuggestionInvocationBody
  | ViewSubmissionInvocationBody
  | ViewClosedInvocationBody
  | FunctionInvocationBody
  | BaseEventInvocationBody;

// Invocation Bodies
export type FunctionInvocationBody = {
  event: {
    type: typeof EventTypes.FUNCTION_EXECUTED;
    function: {
      callback_id: string;
    };
    function_execution_id: string;
    inputs: FunctionInputValues;
    bot_access_token: string;
  };
  /**
   * Only exists when executed in an enterprise workspace.
   */
  enterprise_id?: string;
};

// All events other than the main function_executed one have at least these properties
export type BaseEventInvocationBody = {
  bot_access_token?: string;
  function_data?: FunctionData;
  /**
   * Only exists when executed in an enterprise workspace. Otherwise at runtime is `null`.
   */
  enterprise?: { id: string };
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
};

export type BlockActionInvocationBody = BaseEventInvocationBody & {
  type: typeof EventTypes.BLOCK_ACTIONS;
  actions: BlockAction[];
};

export type BlockSuggestionInvocationBody = BaseEventInvocationBody & {
  type: typeof EventTypes.BLOCK_SUGGESTION;
};

export type ViewClosedInvocationBody = BaseEventInvocationBody & {
  type: typeof EventTypes.VIEW_CLOSED;
  view: View;
};

export type ViewSubmissionInvocationBody = BaseEventInvocationBody & {
  type: typeof EventTypes.VIEW_SUBMISSION;
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

export type BaseHandlerArgs = {
  body: ValidInvocationPayloadBody;
  env: EnvironmentVariables;
  enterprise_id: string;
  inputs: FunctionInputValues;
  token: string;
  team_id: string;
};

export type FunctionHandlerArgs = BaseHandlerArgs & {
  event: FunctionInvocationBody["event"];
};

export type FunctionHandler = {
  (
    args: FunctionHandlerArgs,
  ): Promise<FunctionHandlerReturnArgs> | FunctionHandlerReturnArgs;
};

type FunctionHandlers = {
  blockActions?: BlockActionsHandler;
  blockSuggestion?: BlockSuggestionHandler;
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
  BLOCK_SUGGESTION: "block_suggestion",
  VIEW_SUBMISSION: "view_submission",
  VIEW_CLOSED: "view_closed",
} as const;

export type ValidEventType = typeof EventTypes[keyof typeof EventTypes];

// --- Unhandled Event Types --- //
type UnhandledEventHandlerArgs = BaseHandlerArgs & {
  body: BaseEventInvocationBody;
};

type UnhandledEventHandler = {
  // deno-lint-ignore no-explicit-any
  (args: UnhandledEventHandlerArgs): Promise<any> | any;
};

// --- Block Actions Types -- //
// deno-lint-ignore no-explicit-any
type BlockAction = any;

export type BlockActionsHandlerArgs = BaseHandlerArgs & {
  action: BlockAction;
  body: BlockActionInvocationBody;
};

export type BlockActionsHandler = {
  // deno-lint-ignore no-explicit-any
  (args: BlockActionsHandlerArgs): Promise<any> | any;
};

// --- Block Suggestion Types -- //
export type BlockSuggestionHandlerArgs = BaseHandlerArgs & {
  body: BlockSuggestionInvocationBody;
};

export type BlockSuggestionHandler = {
  // deno-lint-ignore no-explicit-any
  (args: BlockSuggestionHandlerArgs): Promise<any> | any;
};

// --- View Closed Types --- //
// deno-lint-ignore no-explicit-any
type View = any;

type ViewClosedHandlerArgs = BaseHandlerArgs & {
  body: ViewClosedInvocationBody;
  view: View;
};

type ViewClosedHandler = {
  // deno-lint-ignore no-explicit-any
  (args: ViewClosedHandlerArgs): Promise<any> | any;
};

// --- View Submission Types --- //
type ViewSubmissionHandlerArgs = BaseHandlerArgs & {
  body: ViewSubmissionInvocationBody;
  view: View;
};

type ViewSubmissionHandler = {
  // deno-lint-ignore no-explicit-any
  (args: ViewSubmissionHandlerArgs): Promise<any> | any;
};
