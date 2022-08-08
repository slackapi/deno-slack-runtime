import {
  FunctionModule,
  InvocationPayload,
  ViewClosedInvocationBody,
} from "./types.ts";

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
    console.warn(
      "Received view_closed payload but function does not define a viewClosed handler",
    );

    // Return an ack response here by default
    return {};
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
