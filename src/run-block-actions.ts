import {
  BaseHandlerArgs,
  BlockActionInvocationBody,
  EventTypes,
  FunctionModule,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunBlockAction = async (
  baseHandlerArgs: BaseHandlerArgs,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const handler = functionModule.blockActions ||
    functionModule.default?.blockActions;
  if (!handler) {
    throw new UnhandledEventError(
      `Received a ${EventTypes.BLOCK_ACTIONS} payload but the function does not define a blockActions handler`,
    );
  }

  const blockActionBody = baseHandlerArgs.body as BlockActionInvocationBody;
  // We don't catch any errors the handler may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const response: any = await handler({
    ...baseHandlerArgs,
    action: blockActionBody.actions[0],
    body: blockActionBody,
  });

  return response || {};
};
