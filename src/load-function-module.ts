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
  const functionCallbackId = payload?.body?.event?.function?.callback_id ?? "";
  // Lambda reserved env vars: https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-runtime
  // If the LAMBDA_TASK_ROOT env var is undefined, we assume we are not running on lambda, and so on a developer's
  // machine, and thus are in a local run context.
  const projectRoot = Deno.env.get("LAMBDA_TASK_ROOT") || Deno.cwd();
  const functionDir = `${projectRoot}/functions`;
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
    } catch (_) {
      // Error importing function module file
    }
    functionModuleFile = potentialFunctionFiles.shift();
  }

  if (!functionModule) {
    throw new Error(
      `Could not load function module for function: ${functionCallbackId}`,
    );
  }

  return functionModule;
};
