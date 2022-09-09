import { LoadFunctionModule } from "./load-function-module.ts";
import { RunFunction } from "./run-function.ts";
import { RunBlockAction } from "./run-block-actions.ts";
import { RunViewSubmission } from "./run-view-submission.ts";
import { RunViewClosed } from "./run-view-closed.ts";
import {
  hasUnhandledEventHandler,
  isUnhandledEventError,
  RunUnhandledEvent,
  UnhandledEventError,
} from "./run-unhandled-event.ts";
import {
  BaseEventInvocationBody,
  BlockActionInvocationBody,
  EventTypes,
  FunctionInvocationBody,
  FunctionModule,
  InvocationPayload,
  ValidEventType,
  ValidInvocationPayloadBody,
  ViewClosedInvocationBody,
  ViewSubmissionInvocationBody,
} from "./types.ts";

// Given a function callback_id, returns a string to a path to a module, or the module directly
type GetFunctionFileCallback = {
  (functionCallbackId: string): string | FunctionModule;
};

export const DispatchPayload = async (
  // deno-lint-ignore no-explicit-any
  payload: InvocationPayload<any>,
  getFunctionFile: GetFunctionFileCallback,
) => {
  const eventType = payload?.body?.event?.type || payload?.body?.type || "";

  const functionCallbackId = getFunctionCallbackID(eventType, payload);

  if (!functionCallbackId) {
    throw new Error("Could not find the function callback_id in the payload");
  }

  // Let caller resolve how to import the function module
  const potentialFunctionFile = getFunctionFile(functionCallbackId);
  const functionModule = await LoadFunctionModule(potentialFunctionFile);
  if (!functionModule) {
    throw new Error(
      `Could not load function module for function: "${functionCallbackId}" from ${potentialFunctionFile}\nMake sure your function's "source_file" is relative to your project root.`,
    );
  }

  // This response gets passed back to the layer calling the runtime
  // and potentially used as the response to the incoming request
  // that delivered the event payload. Useful for things like view submissions
  // deno-lint-ignore no-explicit-any
  let resp: any = {};

  try {
    switch (eventType) {
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
      default:
        throw new UnhandledEventError(
          `Received a ${eventType} payload but there is no matching handler for the ${functionCallbackId} function.`,
        );
    }
  } catch (handlerError) {
    if (isUnhandledEventError(handlerError)) {
      // Attempt to run the unhandledEvent handler
      if (hasUnhandledEventHandler(functionModule)) {
        resp = await RunUnhandledEvent(payload, functionModule);
      } else {
        console.warn(handlerError.message);
      }
    } else {
      throw handlerError;
    }
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
      return (payload as InvocationPayload<BaseEventInvocationBody>)?.body
        ?.function_data?.function?.callback_id ?? "";
  }
}
