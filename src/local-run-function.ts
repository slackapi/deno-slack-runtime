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
  walkieTalkie: Protocol,
): Promise<void> {
  const workingDirectory = Deno.cwd();
  const manifest = await create({
    manifestOnly: true,
    log: walkieTalkie.log,
    workingDirectory,
  });
  if (!manifest.functions) {
    throw new Error(
      `No function definitions were found in the manifest! manifest.functions: ${manifest.functions}`,
    );
  }
  const payload = await parse(readStdin);

  // Finds the corresponding function in the manifest definition, and then uses
  // the `source_file` property to determine the function module file location
  const resp = await dispatch(payload, walkieTalkie, (functionCallbackId) => {
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
  walkieTalkie.respond(JSON.stringify(resp || {}));
};

if (import.meta.main) {
  const walkieTalkie = getProtocolInterface(Deno.args);
  await runLocally(
    createManifest,
    ParsePayload,
    readAll,
    DispatchPayload,
    walkieTalkie,
  );
}
