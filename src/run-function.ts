import {
  EventTypes,
  FunctionInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunFunction = async (
  payload: InvocationPayload<FunctionInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const token = body.event?.bot_access_token || context.bot_access_token || "";
  const inputs = body.event?.inputs || {};

  if (!functionModule.default) {
    throw new UnhandledEventError(
      `Received a ${EventTypes.FUNCTION_EXECUTED} payload but the function does not define a default handler`,
    );
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const functionResponse: any = await functionModule.default({
    inputs,
    env,
    token,
    team_id,
    event: body.event,
  });

  return functionResponse || {};
};
