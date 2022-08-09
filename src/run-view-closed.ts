import {
  FunctionModule,
  InvocationPayload,
  ViewClosedInvocationBody,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunViewClosed = async (
  payload: InvocationPayload<ViewClosedInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const view = body.view;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const token = body.bot_access_token || context.bot_access_token || "";
  const inputs = body.function_data?.inputs || {};

  if (!functionModule.viewClosed) {
    throw new UnhandledEventError(
      "Received a view_closed payload but the function does not define a viewClosed handler",
    );
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const closedResp: any = await functionModule.viewClosed({
    inputs,
    env,
    token,
    team_id,
    body,
    view,
  });

  return closedResp || {};
};
