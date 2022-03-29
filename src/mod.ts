import { FunctionInvocationBody, InvocationPayload } from "./types.ts";
import { ParsePayload } from "./parse-payload.ts";
import { readAll } from "https://deno.land/std@0.99.0/io/util.ts";
import { LoadFunctionModule } from "./load-function-module.ts";
import { RunFunction } from "./run-function.ts";

await (async () => {
  const payload = await ParsePayload(readAll);

  // Only supports function_executed events
  // To add support for other events, we need to support a way to provide function-centric handlers for them
  // To support block_actions we would need a corresponding function callback_id provided for any events received
  // in order to route it to the right function's actions handler
  const eventType = payload?.body?.event?.type || payload?.body?.type || "";
  if (eventType != "function_executed") {
    throw new Error(`Unsupported event type: "${eventType || "not_found"}"`);
  }

  const functionModule = await LoadFunctionModule(
    payload as InvocationPayload<FunctionInvocationBody>,
  );

  await RunFunction(
    payload as InvocationPayload<FunctionInvocationBody>,
    functionModule,
  );
  // The CLI expects a JSON payload to be output to stdout
  console.log("{}");
})();