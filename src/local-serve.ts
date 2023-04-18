import { createManifest, getProtocolInterface } from "./deps.ts";
import { SocketModeClient } from "./socket-mode/SocketModeClient.ts";
import { DispatchPayload } from "./dispatch-payload.ts";
import { InvocationPayload } from "./types.ts";

const appToken = Deno.env.get("SLACK_CLI_XAPP");
const bot_access_token = Deno.env.get("SLACK_CLI_XOXB") ?? "";

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

const hookCLI = getProtocolInterface(Deno.args);

const socketModeClient = new SocketModeClient({
  appToken: appToken,
  logger: hookCLI,
});

// Attach listeners to events by type. See: https://api.slack.com/events/message
socketModeClient.on(
  "function_executed",
  async ({ body }) => {
    // deno-lint-ignore no-explicit-any
    const payload: InvocationPayload<any> = {
      body: body,
      context: {
        bot_access_token: bot_access_token,
        team_id: body.team_id,
        variables: {},
      },
    };
    await DispatchPayload(
      payload,
      hookCLI,
      (functionCallbackId) => {
        const functionDefn = manifest.functions[functionCallbackId];
        if (!functionDefn) {
          throw new Error(
            `No function definition for function callback id ${functionCallbackId} was found in the manifest! manifest.functions: ${manifest.functions}`,
          );
        }

        const functionFile =
          `file://${workingDirectory}/${functionDefn.source_file}`;

        return functionFile;
      },
    );
  },
);

(async () => {
  await socketModeClient.start();
})();
