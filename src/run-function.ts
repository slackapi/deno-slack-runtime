import { BaseSlackAPIClient, Protocol } from "./deps.ts";
import { BaseHandlerArgs, EventTypes, FunctionModule } from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunFunction = async (
  baseHandlerArgs: BaseHandlerArgs,
  functionModule: FunctionModule,
  hookCLI: Protocol,
): Promise<void> => {
  // TODO: should we throw if this cannot be found? Alternatively / in addition, if calls below to complete* APIs fail, maybe we should throw then?
  const functionExecutionId = baseHandlerArgs.body.event?.function_execution_id;
  // TODO: in the future, if we add more of this kind of logging, then perhaps worth considering moving to a structured logger with different log levels
  // this would reduce the amount of `if (debugMode) log(something)` conditional code
  // e.g. https://deno.land/std@0.151.0/log/README.md
  const debugMode = baseHandlerArgs.env["SLACK_DEBUG"] == "true";

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
      ...baseHandlerArgs,
      event: baseHandlerArgs.body.event,
    });

  // App has indicated there's an unrecoverable error with this function invocation
  if (error) {
    const errorPayload = {
      error,
      function_execution_id: functionExecutionId,
    };
    if (debugMode) {
      hookCLI.log(
        "functions.completeError request payload:",
        JSON.stringify(errorPayload, null, 2),
      );
    }
    const errorResp = await client.apiCall(
      "functions.completeError",
      errorPayload,
    );
    if (debugMode) {
      hookCLI.log("functions.completeError response payload:", errorResp);
    }
    return;
  }

  // App has indicated its function completed successfully
  if (completed) {
    const successPayload = {
      outputs,
      function_execution_id: functionExecutionId,
    };
    if (debugMode) {
      hookCLI.log(
        "functions.completeSuccess request payload:",
        JSON.stringify(successPayload, null, 2),
      );
    }
    const successResp = await client.apiCall(
      "functions.completeSuccess",
      successPayload,
    );
    if (debugMode) {
      hookCLI.log("functions.completeSuccess response payload:", successResp);
    }
    return;
  }
};
