import { BaseHandlerArgs, FunctionModule } from "./types.ts";

export const UNHANDLED_EVENT_ERROR = "UnhandledEventError";

export const RunUnhandledEvent = async (
  baseHandlerArgs: BaseHandlerArgs,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const handler = functionModule.unhandledEvent ||
    functionModule.default?.unhandledEvent;
  if (!handler) {
    throw new Error("No unhandledEvent handler");
  }
  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const response: any = await handler(baseHandlerArgs);

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

export function isUnhandledEventError(
  error: unknown,
): error is UnhandledEventError {
  if (error instanceof Error) {
    return error.name === UNHANDLED_EVENT_ERROR;
  }
  return false;
}
