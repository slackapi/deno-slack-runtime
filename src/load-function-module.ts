import {
  FunctionInvocationBody,
  FunctionModule,
  InvocationPayload,
} from "./types.ts";

// Given a function callback_id, import and return the corresponding function module
// provided by the developer. This should have been bundled to live alongside the deno-runtime module
export const LoadFunctionModule = async (
  payload: InvocationPayload<FunctionInvocationBody>,
): Promise<FunctionModule> => {
  const functionCallbackId = payload?.body?.event?.function?.callback_id;
  if (!functionCallbackId) {
    throw new Error("No callback_id provided in payload!");
  }
  // Project root can be optionally provided after invoking the script.
  const projectRoot = Deno.args[0] || Deno.cwd();
  const functionDir = `file://${projectRoot}/functions`;
  const supportedExts = ["js", "ts"];
  const potentialFunctionFiles = supportedExts.map((ext) =>
    `${functionDir}/${functionCallbackId}.${ext}`
  );
  let functionModuleFile = potentialFunctionFiles.shift();
  let functionModule: FunctionModule | null = null;
  while (functionModuleFile) {
    // Import function module

    try {
      functionModule = await import(functionModuleFile);
      break;
    } catch (e) {
      if (e.message.includes("Module not found")) {
        // Likely means the current file extension being loaded does not exist; move on to the next one
        functionModuleFile = potentialFunctionFiles.shift();
      } else {
        // Any other issue other than module-not-found we should raise to the user.
        throw e;
      }
    }
  }

  if (!functionModule) {
    throw new Error(
      `Could not load function module for function: ${functionCallbackId} in ${functionDir}`,
    );
  }

  return functionModule;
};
