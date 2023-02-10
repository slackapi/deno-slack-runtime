import { Protocol } from "./deps.ts";
import {
  BaseEventInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";

export const UNHANDLED_EVENT_ERROR = "UnhandledEventError";

export const RunUnhandledEvent = async (
  payload: InvocationPayload<BaseEventInvocationBody>,
  functionModule: FunctionModule,
  walkieTalkie: Protocol,
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
  // In case this is a local-run, and we use a protocol that has specific rules around when we can use stdout/stderr,
  // we install any protocol-specific mocks required.
  if (walkieTalkie.install) walkieTalkie.install();
  // deno-lint-ignore no-explicit-any
  let response: any = {};
  try {
    response = await handler({
      inputs,
      env,
      token,
      body,
      team_id,
      enterprise_id,
    });
  } catch (e) {
    // In case this is a local-run, and we use a protocol that has specific rules around when we can use stdout/stderr,
    // we uninstall any protocol-specific mocks we installed earlier if userland code explodes, and re-throw the error
    if (walkieTalkie.uninstall) walkieTalkie.uninstall();
    throw e;
  }
  if (walkieTalkie.uninstall) walkieTalkie.uninstall();

  return response || {};
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
