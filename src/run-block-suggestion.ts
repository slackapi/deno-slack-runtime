import {
  BaseHandlerArgs,
  BlockSuggestionInvocationBody,
  EventTypes,
  FunctionModule,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunBlockSuggestion = async (
  baseHandlerArgs: BaseHandlerArgs,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const handler = functionModule.blockSuggestion ||
    functionModule.default?.blockSuggestion;
  if (!handler) {
    throw new UnhandledEventError(
      `Received a ${EventTypes.BLOCK_SUGGESTION} payload but the function does not define a blockSuggestions handler`,
    );
  }

  const blockSuggestionBody = baseHandlerArgs
    .body as BlockSuggestionInvocationBody;
  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const response: any = await handler({
    ...baseHandlerArgs,
    body: blockSuggestionBody,
  });

  return response || {};
};
