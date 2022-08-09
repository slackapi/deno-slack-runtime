import { createManifest, readAll } from "./deps.ts";
import { ParsePayload } from "./parse-payload.ts";
import { getFunctionCallback, runWorker } from "./run-worker.ts";

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
  const functionCallbackID = getFunctionCallback(payload);
  const functionDefn = manifest.functions[functionCallbackID];
  if (!functionDefn) {
    throw new Error(
      `No function definition for function callback id ${functionCallbackID} was found in the manifest! manifest.functions: ${manifest.functions}`,
    );
  }

  const functionFile = `file://${workingDirectory}/${functionDefn.source_file}`;

  // Finds the corresponding function in the manifest definition, and then uses
  // the `source_file` property to determine the function module file location
  const resp = await runWorker(functionCallbackID, functionFile, payload);

  // The CLI expects a JSON payload to be output to stdout
  // This is formalized in the `run` hook of the CLI/SDK Tech Spec:
  // https://corp.quip.com/0gDvAsqoaaYE/Proposal-CLI-SDK-Interface#temp:C:fOC1991c5aec8994d0db01d26260
  console.log(JSON.stringify(resp || {}));
};

if (import.meta.main) {
  await runLocally();
}
