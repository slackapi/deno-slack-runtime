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
  BaseHandlerArgs,
  EventTypes,
  FunctionInvocationBody,
  FunctionModule,
  InvocationPayload,
  ValidEventType,
  ValidInvocationPayloadBody,
} from "./types.ts";
import { Protocol } from "./deps.ts";

// Given a function callback_id, returns a string to a path to a module, or the module directly
type GetFunctionFileCallback = {
  (functionCallbackId: string): string | FunctionModule;
};

// A helper structure that maps event names to the functions responsible for invoking userland code with the relevant event's payload
const EVENT_TO_HANDLER_MAP = {
  [EventTypes.FUNCTION_EXECUTED]: RunFunction,
  [EventTypes.BLOCK_ACTIONS]: RunBlockAction,
  [EventTypes.BLOCK_SUGGESTION]: RunBlockSuggestion,
  [EventTypes.VIEW_CLOSED]: RunViewClosed,
  [EventTypes.VIEW_SUBMISSION]: RunViewSubmission,
};

export const DispatchPayload = async (
  // deno-lint-ignore no-explicit-any
  payload: InvocationPayload<any>,
  hookCLI: Protocol,
  getFunctionFile: GetFunctionFileCallback,
) => {
  // TODO: should we check that this is a ValidEventType at runtime?
  const eventType =
    (payload?.body?.event?.type || payload?.body?.type || "") as ValidEventType;
  const baseHandlerArgs = extractBaseHandlerArgsFromPayload(payload);

  const functionCallbackId = getFunctionCallbackID(eventType, payload);

  // If we can't find a callback_id, we'll warn about it, then ack the event so we don't retry.
  if (!functionCallbackId) {
    hookCLI.warn(
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
    if (!EVENT_TO_HANDLER_MAP[eventType]) {
      throw new UnhandledEventError(
        `Received an unsupported event of type: "${eventType}" for the ${functionCallbackId} function.`,
      );
    }
    resp = await EVENT_TO_HANDLER_MAP[eventType](
      baseHandlerArgs,
      functionModule,
    );
    }
  } catch (handlerError) {
    if (isUnhandledEventError(handlerError)) {
      // Attempt to run the unhandledEvent handler
      if (hasUnhandledEventHandler(functionModule)) {
        resp = await RunUnhandledEvent(baseHandlerArgs, functionModule);
      } else {
        hookCLI.warn(handlerError.message);
      }
    } else if (isAllowNetError(handlerError)) {
      handlerError.message =
        "Detected missing network permissions; add the domain to your manifest's `outgoingDomains`. Original message: " +
        handlerError.message;
      throw handlerError;
    } else {
      throw handlerError;
    }
  }
  return resp || {};
};

// deno-lint-ignore no-explicit-any
function isAllowNetError(e: any): boolean {
  return e?.name === "PermissionDenied" &&
    typeof e?.message === "string" &&
    e?.message.includes("--allow-net");
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

export function extractBaseHandlerArgsFromPayload(
  payload: InvocationPayload<ValidInvocationPayloadBody>,
): BaseHandlerArgs {
  const { body, context } = payload;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const enterprise_id = body.enterprise_id ||
    (body as BaseEventInvocationBody).enterprise?.id || "";
  const token = (body as FunctionInvocationBody).event?.bot_access_token ||
    (body as BaseEventInvocationBody).bot_access_token ||
    context.bot_access_token || "";
  const inputs = (body as FunctionInvocationBody).event?.inputs ||
    (body as BaseEventInvocationBody).function_data?.inputs || {};
  return {
    body,
    env,
    enterprise_id,
    inputs,
    token,
    team_id,
  };
}
