import { readAll } from "./deps.ts";
import { ParsePayload } from "./parse-payload.ts";
import { DispatchPayload } from "./dispatch-payload.ts";

export const run = async function (functionDir: string) {
  // Directory containing functions must be provided when invoking this script.
  if (!functionDir) {
    throw new Error("Missing function-directory argument!");
  }
  functionDir = `file://${await Deno.realPath(functionDir)}`;

  const payload = await ParsePayload(readAll);

  // For the hosted runtime, we only support js files named w/ the callback_id
  // They should already be bundled into single files as part of the package uploaded
  const resp = await DispatchPayload(payload, (functionCallbackId) => {
    return [`${functionDir}/${functionCallbackId}.js`];
  });

  // The CLI expects a JSON payload to be output to stdout
  // This is formalized in the `run` hook of the CLI/SDK Tech Spec:
  // https://corp.quip.com/0gDvAsqoaaYE/Proposal-CLI-SDK-Interface#temp:C:fOC1991c5aec8994d0db01d26260
  console.log(JSON.stringify(resp || {}));
};

if (import.meta.main) {
  await run(Deno.args[0]);
}
