import {
  FunctionModule,
  InvocationPayload,
  ViewSubmissionInvocationBody,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunViewSubmission = async (
  payload: InvocationPayload<ViewSubmissionInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const view = body.view;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const token = body.bot_access_token || context.bot_access_token || "";
  const inputs = body.function_data?.inputs || {};

  if (!functionModule.viewSubmission) {
    throw new UnhandledEventError(
      "Received a view_submission payload but the function does not define a viewSubmission handler",
    );
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const submissionResp: any = await functionModule.viewSubmission({
    inputs,
    env,
    token,
    team_id,
    body,
    view,
  });

  return submissionResp || {};
};
