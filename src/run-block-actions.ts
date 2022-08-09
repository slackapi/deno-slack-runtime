import {
  BlockActionInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunBlockAction = async (
  payload: InvocationPayload<BlockActionInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const token = body.bot_access_token || context.bot_access_token || "";
  const inputs = body.function_data?.inputs || {};

  if (!functionModule.blockActions) {
    throw new UnhandledEventError(
      "Received a block_actions payload but the function does not define a blockActions handler",
    );
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const actionsResp: any = await functionModule.blockActions({
    inputs,
    env,
    token,
    team_id,
    body,
    action: body.actions[0],
  });

  return actionsResp || {};
};
