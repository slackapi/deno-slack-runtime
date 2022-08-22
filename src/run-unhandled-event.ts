import {
  BaseEventInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";

export const RunUnhandledEvent = async (
  payload: InvocationPayload<BaseEventInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const token = body.bot_access_token || context.bot_access_token || "";
  const inputs = body.function_data?.inputs || {};

  if (!functionModule.unhandledEvent) {
    throw new Error("No unhandledEvent handler");
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const closedResp: any = await functionModule.unhandledEvent({
    inputs,
    env,
    token,
    body,
    team_id,
  });

  return closedResp || {};
};

export class UnhandledEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnhandledEventError";
  }
}
