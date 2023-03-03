import {
  createManifest,
  getProtocolInterface,
  Protocol,
  readAll,
} from "./deps.ts";
import { ParsePayload } from "./parse-payload.ts";
import { DispatchPayload } from "./dispatch-payload.ts";

/**
 * @description Runs an application function locally by dispatching a payload to it after loading it.
 */
export const runLocally = async function (
  create: typeof createManifest,
  parse: typeof ParsePayload,
  readStdin: typeof readAll,
  dispatch: typeof DispatchPayload,
  hookCLI: Protocol,
): Promise<void> {
  const workingDirectory = Deno.cwd();
  const manifest = await create({
    manifestOnly: true,
    log: () => {},
    workingDirectory,
  });
  if (!manifest.functions) {
    throw new Error(
      `No function definitions were found in the manifest! manifest.functions: ${manifest.functions}`,
    );
  }
  // The `start` hook, which powers local run, expects event payloads over stdin
  const payload = await parse(readStdin);

  // Finds the corresponding function in the manifest definition, and then uses
  // the `source_file` property to determine the function module file location
  const resp = await dispatch(payload, hookCLI, (functionCallbackId) => {
    const functionDefn = manifest.functions[functionCallbackId];
    if (!functionDefn) {
      throw new Error(
        `No function definition for function callback id ${functionCallbackId} was found in the manifest! manifest.functions: ${manifest.functions}`,
      );
    }

    const functionFile =
      `file://${workingDirectory}/${functionDefn.source_file}`;

    return functionFile;
  });
  // Use the specific protocol implementation to respond to the CLI
  hookCLI.respond(JSON.stringify(resp || {}));
};

if (import.meta.main) {
  const hookCLI = getProtocolInterface(Deno.args);
  await runLocally(
    createManifest,
    ParsePayload,
    readAll,
    DispatchPayload,
    hookCLI,
  );
}
