import { LoadFunctionModule } from "./load-function-module.ts";
import { RunFunction } from "./run-function.ts";
import { RunBlockAction } from "./run-block-actions.ts";
import { RunViewSubmission } from "./run-view-submission.ts";
import { RunViewClosed } from "./run-view-closed.ts";
import {
  BlockActionInvocationBody,
  EventTypes,
  FunctionInvocationBody,
  InvocationPayload,
  ValidEventType,
  ViewClosedInvocationBody,
  ViewSubmissionInvocationBody,
  WorkerEventMessage,
} from "./types.ts";

export const DispatchPayload = async (
  message: WorkerEventMessage,
) => {
  const { functionCallbackID, functionFile, payload } = message;

  const eventType = payload?.body?.event?.type || payload?.body?.type || "";

  if (!Object.values(EventTypes).includes(eventType)) {
    throw new Error(`Unsupported event type: "${eventType || "not_found"}"`);
  }

  const validEventType: ValidEventType = eventType;

  // Let caller resolve the function directory
  // const potentialFunctionFiles = getFunctionFiles(functionCallbackId);
  // TODO: swap to just a single file arg vs. array of files
  const functionModule = await LoadFunctionModule([functionFile]);
  if (!functionModule) {
    throw new Error(
      `Could not load function module for function: "${functionCallbackID}" in any of the following locations: \n${functionFile}\nMake sure your function's "source_file" is relative to your project root.`,
    );
  }

  // This response gets passed back to the layer calling the runtime
  // and potentially used as the response to the incoming request
  // that delivered the event payload. Useful for things like view submissions
  // deno-lint-ignore no-explicit-any
  let resp: any = {};

  switch (validEventType) {
    case EventTypes.FUNCTION_EXECUTED:
      resp = await RunFunction(
        payload as InvocationPayload<FunctionInvocationBody>,
        functionModule,
      );
      break;
    case EventTypes.BLOCK_ACTIONS:
      resp = await RunBlockAction(
        payload as InvocationPayload<BlockActionInvocationBody>,
        functionModule,
      );
      break;
    case EventTypes.VIEW_SUBMISSION:
      resp = await RunViewSubmission(
        payload as InvocationPayload<ViewSubmissionInvocationBody>,
        functionModule,
      );
      break;
    case EventTypes.VIEW_CLOSED:
      resp = await RunViewClosed(
        payload as InvocationPayload<ViewClosedInvocationBody>,
        functionModule,
      );
      break;
  }

  return resp || {};
};
