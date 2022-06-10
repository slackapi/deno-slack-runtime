import { LoadFunctionModule } from "./load-function-module.ts";
import { RunFunction } from "./run-function.ts";
import { RunBlockAction } from "./run-block-action.ts";
import { RunViewSubmission } from "./run-view-submission.ts";
import {
  BlockActionInvocationBody,
  EventTypes,
  FunctionInvocationBody,
  InvocationPayload,
  ValidEventType,
  ViewSubmissionInvocationBody,
} from "./types.ts";

type ResolveFunctionDirCallback = {
  (functionCallbackId: string): string[];
};

export const DispatchPayload = async (
  // deno-lint-ignore no-explicit-any
  payload: InvocationPayload<any>,
  getFunctionFiles: ResolveFunctionDirCallback,
) => {
  const eventType = payload?.body?.event?.type || payload?.body?.type || "";

  if (!Object.values(EventTypes).includes(eventType)) {
    throw new Error(`Unsupported event type: "${eventType || "not_found"}"`);
  }

  const validEventType: ValidEventType = eventType;
  let functionCallbackId = payload?.body?.event?.function?.callback_id;

  // ---------------------------------------------------------------
  //TODO: Remove this once all supported payloads include it
  // hard-coding missing function callback_id for testing purposes
  if (!functionCallbackId) {
    functionCallbackId = "approval";
  }
  // ---------------------------------------------------------------

  // Let caller resolve the function directory
  const potentialFunctionFiles = getFunctionFiles(functionCallbackId);

  const functionModule = await LoadFunctionModule(potentialFunctionFiles);

  if (!functionModule) {
    throw new Error(
      `Could not load function module for function: "${functionCallbackId}" in any of the following locations: \n${
        potentialFunctionFiles.join("\n")
      }\nMake sure your function's "source_file" is relative to your project root.`,
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
  }

  return resp || {};
};
