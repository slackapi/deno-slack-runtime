import {
  BlockActionInvocationBody,
  EventTypes,
  FunctionInvocationBody,
  InvocationPayload,
  ValidEventType,
  ValidInvocationPayloadBody,
  ViewClosedInvocationBody,
  ViewSubmissionInvocationBody,
  WorkerEventMessage,
  WorkerEventTypes,
  WorkerResponseMessage,
} from "./types.ts";

const DEFAULT_WORKER_TIMEOUT = 15 * 60 * 1000;

export const runWorker = async function (
  /** callback_id of the Function */
  functionCallbackID: string,
  /** Directory function modules reside in */
  functionFile: string,
  /** Invocation payload */
  // deno-lint-ignore no-explicit-any
  payload: InvocationPayload<any>,
  /** Timeout for function event */
  timeoutMS: number = DEFAULT_WORKER_TIMEOUT,
) {
  const worker = new Worker(new URL("./worker.ts", import.meta.url).href, {
    type: "module",
  });

  let timeout: number | undefined;

  const workerPromise = new Promise((resolve) => {
    worker.onmessage = (msg: MessageEvent<WorkerResponseMessage>) => {
      console.log("worker msg receivd", msg);
      if (timeout) {
        clearTimeout(timeout);
      }
      resolve(msg.data.response);
    };

    const workerMessage: WorkerEventMessage = {
      type: WorkerEventTypes.FunctionEvent,
      functionCallbackID,
      functionFile,
      payload,
    };

    worker.postMessage(workerMessage);
  });

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject("Function timeout exceeded");
    }, timeoutMS);
  });

  try {
    // We kick off the worker and a timeout to terminate the worker if it goes too long
    const response = await Promise.race([workerPromise, timeoutPromise]);

    return response;
  } catch (err) {
    console.log(err);
    worker.terminate();

    return {};
  }
};

// deno-lint-ignore no-explicit-any
export function getFunctionCallback(payload: InvocationPayload<any>) {
  const eventType = payload?.body?.event?.type || payload?.body?.type || "";

  // TODO: Don't throw here and allow for unhandled event types
  if (!Object.values(EventTypes).includes(eventType)) {
    throw new Error(`Unsupported event type: "${eventType || "not_found"}"`);
  }

  const validEventType: ValidEventType = eventType;
  const functionCallbackId = getFunctionCallbackIDByEvent(
    validEventType,
    payload,
  );

  if (!functionCallbackId) {
    throw new Error("Could not find the function callback_id in the payload");
  }

  return functionCallbackId;
}

function getFunctionCallbackIDByEvent(
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
