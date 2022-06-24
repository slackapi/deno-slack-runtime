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
  ValidInvocationPayloadBody,
  ViewClosedInvocationBody,
  ViewSubmissionInvocationBody,
} from "./types.ts";

// Given a function callback_id, returns a set of potential function files to check
type GetFunctionFilesCallback = {
  (functionCallbackId: string): string[];
};

export const DispatchPayload = async (
  // deno-lint-ignore no-explicit-any
  payload: InvocationPayload<any>,
  getFunctionFiles: GetFunctionFilesCallback,
) => {
  const eventType = payload?.body?.event?.type || payload?.body?.type || "";

  if (!Object.values(EventTypes).includes(eventType)) {
    throw new Error(`Unsupported event type: "${eventType || "not_found"}"`);
  }

  const validEventType: ValidEventType = eventType;
  let functionCallbackId = getFunctionCallbackID(validEventType, payload);

  // ---------------------------------------------------------------
  //TODO: Remove this once all supported payloads include it
  // hard-coding missing function callback_id for testing purposes
  if (!functionCallbackId) {
    console.log(
      "no function callback_id found, hard-coding to approval for testing purposes",
    );
    functionCallbackId = "approval";
  }
  // ---------------------------------------------------------------

  if (!functionCallbackId) {
    throw new Error("Could not find the function callback_id in the payload");
  }

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
    case EventTypes.VIEW_CLOSED:
      resp = await RunViewClosed(
        payload as InvocationPayload<ViewClosedInvocationBody>,
        functionModule,
      );
      break;
  }

  return resp || {};
};

function getFunctionCallbackID(
  eventType: ValidEventType,
  payload: InvocationPayload<ValidInvocationPayloadBody>,
): string {
  switch (eventType) {
    case EventTypes.FUNCTION_EXECUTED:
      return (payload as InvocationPayload<FunctionInvocationBody>)?.body?.event
        ?.function?.callback_id ?? "";
    case EventTypes.BLOCK_ACTIONS:
      return (payload as InvocationPayload<BlockActionInvocationBody>)?.body
        ?.function_data?.function?.callback_id ?? "";
    case EventTypes.VIEW_CLOSED:
      return (payload as InvocationPayload<ViewClosedInvocationBody>)?.body
        ?.function_data?.function?.callback_id ?? "";
    case EventTypes.VIEW_SUBMISSION:
      return (payload as InvocationPayload<ViewSubmissionInvocationBody>)?.body
        ?.function_data?.function?.callback_id ?? "";
    default:
      return "";
  }
}
