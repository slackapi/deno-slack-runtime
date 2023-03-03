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
  // TODO: if userland code has `console.log`s _outside_ of a function handler, at the top level scope of the module, _and_ the current execution is a local run and not a deployed-on-ROSI run,
  // _and_ the protocol to be used has specific rules around how stdout/stderr should be used, then things might break at this point. For now, neither of the two protocol implementations have such
  // rules so we are safe, however, if in the future we release new protocols that _do_ have such rules, we would need to introduce changes (described next).
  // If we want to be really careful here, we can pass in the Protocol interface and call the install() and uninstall() methods (if they exist) before
  // and after the import to guard against that. something like:
  // if (walkieTalkie.install) walkieTalkie.install(); await import(); if (walkieTalkie.uninstall) walkieTalkie.uninstall();
  return await import(potentialFunctionFile as string);
};
