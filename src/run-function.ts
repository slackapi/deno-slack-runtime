import { BaseSlackAPIClient } from "./deps.ts";
import {
  EventTypes,
  FunctionInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunFunction = async (
  payload: InvocationPayload<FunctionInvocationBody>,
  functionModule: FunctionModule,
): Promise<void> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const enterprise_id = body.enterprise_id || "";
  const token = body.event?.bot_access_token || context.bot_access_token || "";
  const functionExecutionId = body.event?.function_execution_id;
  const inputs = body.event?.inputs || {};

  if (!functionModule.default) {
    throw new UnhandledEventError(
      `Received a ${EventTypes.FUNCTION_EXECUTED} payload but the function does not define a default handler`,
    );
  }

  const client = new BaseSlackAPIClient(token, {
    slackApiUrl: env["SLACK_API_URL"],
  });

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  const { completed = true, outputs = {}, error } = await functionModule
    .default({
      inputs,
      env,
      token,
      team_id,
      enterprise_id,
      event: body.event,
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
