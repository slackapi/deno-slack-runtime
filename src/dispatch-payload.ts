import { LoadFunctionModule } from "./load-function-module.ts";
import { RunFunction } from "./run-function.ts";
import { RunBlockAction } from "./run-block-actions.ts";
import { RunBlockSuggestion } from "./run-block-suggestion.ts";
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
  BlockSuggestionInvocationBody,
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

  // If we can't find a callback_id, we'll warn about it, then ack the event so we don't retry.
  if (!functionCallbackId) {
    console.warn(
      `Could not find the function "callback_id" in the payload for an event type of "${
        eventType || "unknown"
      }"`,
    );
    return {};
  }

  // Let caller resolve how to import the function module
  const potentialFunctionFile = getFunctionFile(functionCallbackId);
  const functionModule = await LoadFunctionModule(potentialFunctionFile);

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
      case EventTypes.BLOCK_SUGGESTION:
        resp = await RunBlockSuggestion(
          payload as InvocationPayload<BlockSuggestionInvocationBody>,
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
          `Received an unsupported event of type: "${eventType}" for the ${functionCallbackId} function.`,
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
    } else if (isAllowNetError(handlerError)) {
      console.warn(
        "⚠️   deno-slack-runtime: Detected missing network permissions. Add the domain to your manifest's `outgoingDomains` to resolve the `--allow-net` error.",
      );
      throw handlerError;
    } else {
      console.warn(handlerError);
      throw handlerError;
    }
  }

  return resp || {};
};

// deno-lint-ignore no-explicit-any
function isAllowNetError(e: any): boolean {
  return e?.name === "PermissionDenied" &&
    typeof e?.message === "string" &&
    e?.message.includes("run again with the --allow-net flag");
}

function getFunctionCallbackID(
  eventType: ValidEventType,
  payload: InvocationPayload<ValidInvocationPayloadBody>,
): string {
  switch (eventType) {
    case EventTypes.FUNCTION_EXECUTED:
      return (payload as InvocationPayload<FunctionInvocationBody>)?.body?.event
        ?.function?.callback_id ?? "";
    // These all extract the callback_id from the default location
    case EventTypes.BLOCK_ACTIONS:
    case EventTypes.BLOCK_SUGGESTION:
    case EventTypes.VIEW_CLOSED:
    case EventTypes.VIEW_SUBMISSION:
    default:
      return (payload as InvocationPayload<BaseEventInvocationBody>)?.body
        ?.function_data?.function?.callback_id ?? "";
  }
}
