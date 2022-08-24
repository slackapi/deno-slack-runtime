import { createManifest, readAll } from "./deps.ts";
import { ParsePayload } from "./parse-payload.ts";
import { DispatchPayload } from "./dispatch-payload.ts";
import { BaseSlackAPIClient } from "./deps.ts";
import { InvocationPayload } from "./types.ts";

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

  // Finds the corresponding function in the manifest definition, and then uses
  // the `source_file` property to determine the function module file location
  const resp = await DispatchPayload(payload, (functionCallbackId) => {
    const functionDefn = manifest.functions[functionCallbackId];
    if (!functionDefn) {
      throw new Error(
        `No function definition for function callback id ${functionCallbackId} was found in the manifest! manifest.functions: ${manifest.functions}`,
      );
    }

    const functionFile =
      `file://${workingDirectory}/${functionDefn.source_file}`;

    return [functionFile];
  });

  callCompleteAPI(payload, resp);

  // The CLI expects a JSON payload to be output to stdout
  // This is formalized in the `run` hook of the CLI/SDK Tech Spec:
  // https://corp.quip.com/0gDvAsqoaaYE/Proposal-CLI-SDK-Interface#temp:C:fOC1991c5aec8994d0db01d26260
  console.log(JSON.stringify(resp || {}));
};

export const callCompleteAPI = async function (
  // deno-lint-ignore no-explicit-any
  payload: InvocationPayload<any>,
  // deno-lint-ignore no-explicit-any
  resp: any,
) {
  const { body, context } = payload;
  const env = context.variables || {};
  const token = body.event?.bot_access_token || context.bot_access_token || "";
  const functionExecutionId = body.event?.function_execution_id;

  const client = new BaseSlackAPIClient(token, {
    slackApiUrl: env["SLACK_API_URL"],
  });

  const {
    completed = true,
    outputs = {},
    error,
  } = resp;

  // App has indicated there's an unrecoverable error with this function invocation
  if (error) {
    await client.apiCall("functions.completeError", {
      error,
      function_execution_id: functionExecutionId,
    });
  }

  // App has indicated it's function completed successfully
  if (completed) {
    await client.apiCall("functions.completeSuccess", {
      outputs,
      function_execution_id: functionExecutionId,
    });
  }
};

if (import.meta.main) {
  await runLocally();
}
