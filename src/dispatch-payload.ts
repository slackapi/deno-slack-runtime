import { LoadFunctionModule } from "./load-function-module.ts";
import { RunFunction } from "./run-function.ts";
import { RunBlockAction } from "./run-block-actions.ts";
import {
  BlockActionInvocationBody,
  EventTypes,
  FunctionInvocationBody,
  InvocationPayload,
  ValidEventType,
  ValidInvocationPayloadBody,
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
  const functionCallbackId = getFunctionCallbackID(validEventType, payload);

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
    default:
      return "";
  }
}
