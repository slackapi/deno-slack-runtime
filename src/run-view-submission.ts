import {
  FunctionModule,
  InvocationPayload,
  ViewSubmissionInvocationBody,
} from "./types.ts";

export const RunViewSubmission = async (
  payload: InvocationPayload<ViewSubmissionInvocationBody>,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const env = context.variables || {};
  const token = context.bot_access_token || body.bot_access_token || "";

  if (!functionModule.viewSubmission) {
    throw new Error(
      "Received view_submission payload but function does not define any view submission handlers",
    );
  }

  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // TODO: type response here
  // deno-lint-ignore no-explicit-any
  const submissionResp: any = await functionModule.viewSubmission({
    body,
    token,
    env,
  });

  return submissionResp || {};
};
