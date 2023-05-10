import { BaseSlackAPIClient } from "./deps.ts";
import { BaseHandlerArgs, EventTypes, FunctionModule } from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunFunction = async (
  baseHandlerArgs: BaseHandlerArgs,
  functionModule: FunctionModule,
): Promise<void> => {
  // TODO: should we throw if this cannot be found?
  const functionExecutionId = baseHandlerArgs.body.event?.function_execution_id;

  if (!functionModule.default) {
    throw new UnhandledEventError(
      `Received a ${EventTypes.FUNCTION_EXECUTED} payload but the function does not define a default handler`,
    );
  }

  const client = new BaseSlackAPIClient(baseHandlerArgs.token, {
    slackApiUrl: baseHandlerArgs.env["SLACK_API_URL"],
  });

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  const { completed = true, outputs = {}, error } = await functionModule
    .default({
      event: baseHandlerArgs.body.event,
      ...baseHandlerArgs,
    });

  // App has indicated there's an unrecoverable error with this function invocation
  if (error) {
    await client.apiCall("functions.completeError", {
      error,
      function_execution_id: functionExecutionId,
    });
    return;
  }

  // App has indicated its function completed successfully
  if (completed) {
    await client.apiCall("functions.completeSuccess", {
      outputs,
      function_execution_id: functionExecutionId,
    });
    return;
  }
};
