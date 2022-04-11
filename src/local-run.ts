import { createManifest, dirname, readAll } from "./deps.ts";

import { FunctionInvocationBody, InvocationPayload } from "./types.ts";
import { ParsePayload } from "./parse-payload.ts";
import { LoadFunctionModule } from "./load-function-module.ts";
import { RunFunction } from "./run-function.ts";

export const runLocally = async function () {
  const workingDirectory = Deno.cwd();
  const manifest = await createManifest({
    manifestOnly: true,
    log: () => {},
    workingDirectory,
  });
  if (!manifest.functions) {
    throw new Error(
      `No function definitions were found in the manifest! manifest.functions: ${manifest.functions}`,
    );
  }
  const payload = await ParsePayload(readAll);

  // Only supports function_executed events
  // To add support for other events, we need to support a way to provide function-centric handlers for them
  // To support block_actions we would need a corresponding function callback_id provided for any events received
  // in order to route it to the right function's actions handler
  const eventType = payload?.body?.event?.type || payload?.body?.type || "";
  if (eventType != "function_executed") {
    throw new Error(`Unsupported event type: "${eventType || "not_found"}"`);
  }

  // Based on the function callback_id, look for a source_file property in the underlying manifest's function definition for local run
  const functionCallbackId = payload?.body?.event?.function?.callback_id;
  const functionDefn = manifest.functions[functionCallbackId];
  if (!functionDefn) {
    throw new Error(
      `No function definition for function callback id ${functionCallbackId} was found in the manifest! manifest.functions: ${manifest.functions}`,
    );
  }
  const functionDir = `file://${workingDirectory}/${
    dirname(functionDefn.source_file)
  }`;

  const functionModule = await LoadFunctionModule(
    functionDir,
    payload as InvocationPayload<FunctionInvocationBody>,
  );

  await RunFunction(
    payload as InvocationPayload<FunctionInvocationBody>,
    functionModule,
  );
  // The CLI expects a JSON payload to be output to stdout
  // This is formalized in the `run` hook of the CLI/SDK Tech Spec:
  // https://corp.quip.com/0gDvAsqoaaYE/Proposal-CLI-SDK-Interface#temp:C:fOC1991c5aec8994d0db01d26260
  console.log("{}");
};

if (import.meta.main) {
  await runLocally();
}
