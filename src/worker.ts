import { DispatchPayload } from "./dispatch-payload.ts";
import { WorkerEventMessage, WorkerEventTypes } from "./types.ts";

// register the message handler first
// deno-lint-ignore ban-ts-comment
// @ts-ignore
self.onmessage = async (event: MessageEvent<WorkerEventMessage>) => {
  console.log(event.data);
  // const { type, payload, functionFile, functionCallbackID } = event.data;

  if (event.data.type === WorkerEventTypes.FunctionEvent) {
    // For the hosted runtime, we only support js files named w/ the callback_id
    // They should already be bundled into single files as part of the package uploaded
    const response = await DispatchPayload(event.data);
    console.log("worker response", response);
    // Send the result back to the main thread
    // deno-lint-ignore ban-ts-comment
    // @ts-ignore
    await self.postMessage({ response });
  }

  // Close the Worker
  self.close();
};
