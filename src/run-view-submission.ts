import {
  BaseHandlerArgs,
  EventTypes,
  FunctionModule,
  ViewSubmissionInvocationBody,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";

export const RunViewSubmission = async (
  baseHandlerArgs: BaseHandlerArgs,
  functionModule: FunctionModule,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const handler = functionModule.viewSubmission ||
    functionModule.default?.viewSubmission;
  if (!handler) {
    throw new UnhandledEventError(
      `Received a ${EventTypes.VIEW_SUBMISSION} payload but the function does not define a viewSubmission handler`,
    );
  }

  const viewSubmissionBody = baseHandlerArgs
    .body as ViewSubmissionInvocationBody;
  // We don't catch any errors the handlers may throw, we let them throw, and stop the process
  // deno-lint-ignore no-explicit-any
  const response: any = await handler({
    ...baseHandlerArgs,
    body: viewSubmissionBody,
    view: viewSubmissionBody.view,
  });

  return response || {};
};
