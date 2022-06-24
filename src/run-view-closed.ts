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
  const token = body.bot_access_token || context.bot_access_token || "";
  const inputs = body.function_data?.inputs || {};

  if (!functionModule.viewClosed) {
    throw new Error(
      "Received view_submission payload but function does not define any view submission handlers",
    );
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // TODO: type response here
  // deno-lint-ignore no-explicit-any
  const closedResp: any = await functionModule.viewClosed({
    view,
    body,
    token,
    inputs,
    env,
  });

  return closedResp || {};
};
