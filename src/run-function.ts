import { BaseSlackAPIClient, Protocol } from "./deps.ts";
import {
  EventTypes,
  FunctionHandlerReturnArgs,
  FunctionInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunFunction = async (
  payload: InvocationPayload<FunctionInvocationBody>,
  functionModule: FunctionModule,
  walkieTalkie: Protocol,
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

  // In case this is a local-run, and we use a protocol that has specific rules around when we can use stdout/stderr,
  // we install any protocol-specific mocks required.
  if (walkieTalkie.install) walkieTalkie.install();
  let response: FunctionHandlerReturnArgs = {};
  try {
    response = await functionModule.default({
      inputs,
      env,
      token,
      team_id,
      enterprise_id,
      event: body.event,
    });
  } catch (e) {
    // In case this is a local-run, and we use a protocol that has specific rules around when we can use stdout/stderr,
    // we uninstall any protocol-specific mocks we installed earlier if userland code explodes, and re-throw the error
    if (walkieTalkie.uninstall) walkieTalkie.uninstall();
    throw e;
  }
  if (walkieTalkie.uninstall) walkieTalkie.uninstall();
  // App has indicated there's an unrecoverable error with this function invocation
  if (response.error) {
    await client.apiCall("functions.completeError", {
      error: response.error,
      function_execution_id: functionExecutionId,
    });
    return;
  }

  // App has indicated its function completed successfully
  if (response.completed) {
    await client.apiCall("functions.completeSuccess", {
      outputs: response.outputs,
      function_execution_id: functionExecutionId,
    });
    return;
  }
};
