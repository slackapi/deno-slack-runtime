import { FunctionModule } from "./types.ts";

/**
 * Given a string to a path for a module, or a module itself, import the module
 * and return
 */
export const LoadFunctionModule = async (
  potentialFunctionFile: string | FunctionModule,
): Promise<FunctionModule> => {
  // If the module itself was provided, just return it.
  if (typeof potentialFunctionFile === "object") {
    return potentialFunctionFile;
  }

  // Let exceptions be thrown, error would bubble up in both local and
  // remote running contexts.
  return await import(potentialFunctionFile as string);
};
