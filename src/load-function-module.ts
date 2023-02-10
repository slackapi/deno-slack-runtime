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
  // TODO: if userland code has `console.log`s _outside_ of a function handler, at the top level scope of the module, then things might break.
  // If we want to be really careful here, we can pass in the Protocol interface and call the install() and uninstall() methods (if they exist) before
  // and after the import to guard against that.
  return await import(potentialFunctionFile as string);
};
