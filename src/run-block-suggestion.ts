import {
  BlockSuggestionInvocationBody,
  EventTypes,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunBlockSuggestion = async (
  payload: InvocationPayload<BlockSuggestionInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const enterprise_id = body.enterprise?.id ?? "";
  const token = body.bot_access_token || context.bot_access_token || "";
  const inputs = body.function_data?.inputs || {};

  const handler = functionModule.blockSuggestion ||
    functionModule.default?.blockSuggestion;
  if (!handler) {
    throw new UnhandledEventError(
      `Received a ${EventTypes.BLOCK_SUGGESTION} payload but the function does not define a blockSuggestions handler`,
    );
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const response: any = await handler({
    inputs,
    env,
    token,
    team_id,
    enterprise_id,
    body,
  });

  return response || {};
};
