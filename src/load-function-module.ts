import { FunctionModule } from "./types.ts";

// Given a function callback_id, import and return the corresponding function module
// provided by the developer. This should have been bundled to live alongside the deno-runtime module
export const LoadFunctionModule = async (
  potentialFunctionFiles: string[],
  // functionDir: string,
  // functionCallbackId: string,
): Promise<FunctionModule | null> => {
  // const supportedExts = ["js", "ts"];
  // const potentialFunctionFiles = supportedExts.map((ext) =>
  //   `${functionDir}/${functionCallbackId}.${ext}`
  // );

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

  // if (!functionModule) {
  //   throw new Error(
  //     `Could not load function module for function: ${functionCallbackId} in ${functionDir}. Make sure your function's "source_file" is relative to your project root.`,
  //   );
  // }

  return functionModule;
};
