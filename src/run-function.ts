import { BaseSlackAPIClient } from "./deps.ts";
import {
  AsyncFunctionHandler,
  FunctionContext,
  FunctionHandlerReturnArgs,
  FunctionInvocationBody,
  FunctionModule,
  InvocationPayload,
  SyncFunctionHandler,
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

  const returnArgs: FunctionHandlerReturnArgs = {
    completed: false,
    outputs: {},
    error: undefined,
  };

  const functionContext: FunctionContext = {
    inputs,
    env,
    token,
    event: body.event,
  };

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  if (functionModule.default.constructor.name === "AsyncFunction") {
    const functionToRun = functionModule.default as AsyncFunctionHandler;

    const {
      completed = true,
      outputs = {},
      error,
    } = await functionToRun(functionContext);

    returnArgs.completed = completed;
    returnArgs.outputs = outputs;
    returnArgs.error = error;
  } else {
    const functionToRun = functionModule.default as SyncFunctionHandler;

    const {
      completed = true,
      outputs = {},
      error,
    } = functionToRun(functionContext);

    returnArgs.completed = completed;
    returnArgs.outputs = outputs;
    returnArgs.error = error;
  }

  // App has indicated there's an unrecoverable error with this function invocation
  if (returnArgs.error) {
    await client.apiCall("functions.completeError", {
      error: returnArgs.error,
      function_execution_id: functionExecutionId,
    });
    return;
  }

  // App has indicated it's function completed successfully
  if (returnArgs.completed) {
    await client.apiCall("functions.completeSuccess", {
      outputs: returnArgs.outputs,
      function_execution_id: functionExecutionId,
    });
    return;
  }
};
