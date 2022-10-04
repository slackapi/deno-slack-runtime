import {
  BaseEventInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";

export const UNHANDLED_EVENT_ERROR = "UnhandledEventError";

export const RunUnhandledEvent = async (
  payload: InvocationPayload<BaseEventInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const enterprise_id = body.enterprise?.id || "";
  const token = body.bot_access_token || context.bot_access_token || "";
  const inputs = body.function_data?.inputs || {};

  const handler = functionModule.unhandledEvent ||
    functionModule.default?.unhandledEvent;
  if (!handler) {
    throw new Error("No unhandledEvent handler");
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const closedResp: any = await handler({
    inputs,
    env,
    token,
    body,
    team_id,
    enterprise_id,
  });

  return closedResp || {};
};

export class UnhandledEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = UNHANDLED_EVENT_ERROR;
  }
}

export const hasUnhandledEventHandler = (functionModule: FunctionModule) => {
  return !!(functionModule.unhandledEvent ||
    functionModule.default?.unhandledEvent);
};

export const isUnhandledEventError = (error: Error) => {
  return error.name === UNHANDLED_EVENT_ERROR;
};
