import {
  BlockActionInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";

export const RunBlockAction = async (
  payload: InvocationPayload<BlockActionInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const token = context.bot_access_token || "";

  if (!functionModule.actions) {
    throw new Error(
      "Received block_actions payload but function does not define any actions handlers",
    );
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // TODO: type response here
  // deno-lint-ignore no-explicit-any
  const actionsResp: any = await functionModule.actions({
    action: body.actions[0],
    body,
    token,
    env,
  });

  return actionsResp || {};
};
