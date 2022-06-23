import { FunctionModule } from "./types.ts";

// Given a set of supported files, look for the slack function module file
export const LoadFunctionModule = async (
  potentialFunctionFiles: string[],
): Promise<FunctionModule | null> => {
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

  return functionModule;
};
