import { BaseSlackAPIClient } from "https://deno.land/x/deno_slack_api@0.0.2/base-client.ts";
import {
  FunctionInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";

export const RunFunction = async (
  payload: InvocationPayload<FunctionInvocationBody>,
  functionModule: FunctionModule,
): Promise<void> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const token = context.bot_access_token || "";
  const functionExecutionId = body.event?.function_execution_id;
  const inputs = body.event?.inputs || {};

  const client = new BaseSlackAPIClient(token, {
    slackApiUrl: env["SLACK_API_URL"],
  });

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  const {
    completed = true,
    outputs = {},
    error,
  } = await functionModule.default({
    inputs,
    env,
    token,
    // pass along the full event for convenience/future properties
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

  // App has indicated it's function completed successfully
  if (completed) {
    await client.apiCall("functions.completeSuccess", {
      outputs,
      function_execution_id: functionExecutionId,
    });
    return;
  }
};
