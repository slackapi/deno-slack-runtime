import { createManifest, parse, readAll } from "./deps.ts";

import {
  BlockActionInvocationBody,
  FunctionInvocationBody,
  InvocationPayload,
  ViewSubmissionInvocationBody,
} from "./types.ts";
import { ParsePayload } from "./parse-payload.ts";
import { LoadFunctionModule } from "./load-function-module.ts";
import { RunFunction } from "./run-function.ts";
import { RunBlockAction } from "./run-block-action.ts";
import { RunViewSubmission } from "./run-view-submission.ts";

// TODO: HAXORZ - hard-coded function callback_id for testing until payloads include it
const TEST_FN_CALLBACK_ID = "approval";

const FUNCTION_EXECUTED_EVENT = "function_executed";
const BLOCK_ACTIONS_EVENT = "block_actions";
const VIEW_SUBMISSION_EVENT = "view_submission";

const SUPPORTED_EVENTS = [
  FUNCTION_EXECUTED_EVENT,
  BLOCK_ACTIONS_EVENT,
  VIEW_SUBMISSION_EVENT,
];

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

  // Only supports function_executed events
  // To add support for other events, we need to support a way to provide function-centric handlers for them
  // To support block_actions we would need a corresponding function callback_id provided for any events received
  // in order to route it to the right function's actions handler
  const eventType = payload?.body?.event?.type || payload?.body?.type || "";
  if (!SUPPORTED_EVENTS.includes(eventType)) {
    throw new Error(`Unsupported event type: "${eventType || "not_found"}"`);
  }

  // Based on the function callback_id, look for a source_file property in the underlying manifest's function definition for local run
  let functionCallbackId = payload?.body?.event?.function?.callback_id;

  // TODO: This is just for a POC for function-centeric block_actions & view_submissions
  // Eventually these events will include a function callback_id we can use to route on
  // For the POC we're hard-coding the callback_id
  if (
    !functionCallbackId &&
    (eventType === BLOCK_ACTIONS_EVENT || eventType === VIEW_SUBMISSION_EVENT)
  ) {
    functionCallbackId = TEST_FN_CALLBACK_ID;
    // TODO: have to do this currently because of how LoadFunctionModule() parses fn callback id out of payload
    // we should refactor it to just accept the callback id and not the full payload
    payload.body.event = {
      function: {
        callback_id: functionCallbackId,
      },
    };
  }

  const functionDefn = manifest.functions[functionCallbackId];
  if (!functionDefn) {
    throw new Error(
      `No function definition for function callback id ${functionCallbackId} was found in the manifest! manifest.functions: ${manifest.functions}`,
    );
  }

  const { dir: sourceDir, name: sourceFilename } = parse(
    functionDefn.source_file,
  );
  const functionDir = `file://${workingDirectory}/${sourceDir}`;

  if (sourceFilename !== payload?.body?.event?.function.callback_id) {
    // Override the callback_id to point at the local file name
    payload.body.event.function.callback_id = sourceFilename;
  }

  const functionModule = await LoadFunctionModule(
    functionDir,
    payload as InvocationPayload<FunctionInvocationBody>,
  );

  switch (eventType) {
    case "function_executed":
      await RunFunction(
        payload as InvocationPayload<FunctionInvocationBody>,
        functionModule,
      );
      break;
    case "block_actions":
      await RunBlockAction(
        payload as InvocationPayload<BlockActionInvocationBody>,
        functionModule,
      );
      break;
    case "view_submission":
      await RunViewSubmission(
        payload as InvocationPayload<ViewSubmissionInvocationBody>,
        functionModule,
      );
      break;
  }

  // The CLI expects a JSON payload to be output to stdout
  // This is formalized in the `run` hook of the CLI/SDK Tech Spec:
  // https://corp.quip.com/0gDvAsqoaaYE/Proposal-CLI-SDK-Interface#temp:C:fOC1991c5aec8994d0db01d26260
  console.log("{}");
};

if (import.meta.main) {
  await runLocally();
}
