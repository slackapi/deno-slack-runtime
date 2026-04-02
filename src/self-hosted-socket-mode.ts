import {
  ConsoleLogger,
  getManifest,
  getProtocolInterface,
  type Logger,
  LogLevel,
  Protocol,
  SocketModeClient,
} from "./deps.ts";
import { getCommandline } from "./local-run.ts";
import type { InvocationPayload } from "./types.ts";

export interface SocketModeRunOptions {
  appToken: string;
  logger?: Logger;
  logLevel?: LogLevel;
  slackApiUrl?: string;
}

/**
 * @description Runs a Slack workflow app in Socket Mode by establishing a WebSocket connection to Slack.
 */
export const runWithSocketMode = async function (
  create: typeof getManifest,
  hookCLI: Protocol,
  options: SocketModeRunOptions,
): Promise<void> {
  const { appToken, logLevel = LogLevel.INFO, slackApiUrl } = options;

  // Set up logger
  const logger = options.logger ?? (() => {
    const defaultLogger = new ConsoleLogger();
    defaultLogger.setLevel(logLevel);
    return defaultLogger;
  })();

  // Load the manifest to get function definitions
  const workingDirectory = Deno.cwd();
  const manifest = await create(workingDirectory);

  if (!manifest.functions) {
    logger.error(
      `No function definitions found in the manifest`,
    );
    throw new Error(
      `No function definitions found in the manifest`,
    );
  }

  const devDomain = slackApiUrl ? new URL(slackApiUrl).hostname : "";
  let denoExecutablePath = "deno";
  try {
    denoExecutablePath = Deno.execPath();
  } catch (e) {
    logger.warn("Could not get Deno executable path, using 'deno'", e);
  }
  // Run the function in a subprocess with restricted permissions
  const subprocessCommand = getCommandline(
    Deno.mainModule,
    manifest,
    devDomain,
    hookCLI,
  );

  const clientOptions = slackApiUrl ? { slackApiUrl } : undefined;
  const client = new SocketModeClient({
    appToken,
    logLevel,
    logger,
    clientOptions,
  });

  // Listen for incoming events
  client.on("slack_event", async ({ body, ack, retry_num, retry_reason }) => {
    logger.debug("Received event:", JSON.stringify(body, null, 2));
    try {
      // deno-lint-ignore no-explicit-any
      const payload: InvocationPayload<any> = {
        body,
        context: {
          bot_access_token: body.event.bot_access_token,
          team_id: body.team_id,
          variables: Deno.env.toObject(),
        },
      };

      // Add retry information if present
      if (retry_num !== undefined && retry_num > 0) {
        logger.warn(
          `Retrying event (attempt ${retry_num})${
            retry_reason ? `: ${retry_reason}` : ""
          }`,
        );
      }

      // Run the function in a subprocess with the same --allow-net restriction as local-run.ts (manifest.outgoing_domains)
      const commander = new Deno.Command(denoExecutablePath, {
        args: subprocessCommand,
        stdin: "piped",
        stdout: "piped",
        stderr: "piped",
        cwd: workingDirectory,
      });
      const subprocess = commander.spawn();
      const payloadJson = JSON.stringify(payload);
      const writer = subprocess.stdin.getWriter();
      await writer.write(new TextEncoder().encode(payloadJson));
      await writer.close();

      const output = await subprocess.output();
      const stdout = new TextDecoder().decode(output.stdout).trim();
      const stderr = new TextDecoder().decode(output.stderr);

      if (!output.success) {
        logger.error(
          `Function subprocess failed (exit code ${output.code}). stderr: ${
            stderr || "(none)"
          }`,
        );
        await ack();
        return;
      }

      if (stdout) {
        logger.info(`Function response: ${stdout}`);
      }

      await ack({});
      logger.debug("Event processed and acknowledged");
    } catch (error) {
      logger.error("Error processing event:", error);
      await ack();
    }
  });

  // Handle connection lifecycle events
  client.on("connected", () => {
    logger.info("✅ Connected to Slack via Socket Mode");
  });

  client.on("disconnected", () => {
    logger.warn("⚠️  Disconnected from Slack");
  });

  client.on("reconnecting", () => {
    logger.info("🔄 Reconnecting to Slack...");
  });

  client.on("error", (error: Error) => {
    logger.error("❌ Socket Mode error:", error);
  });

  // Start the Socket Mode connection
  logger.info("🚀 Starting Socket Mode client...");
  try {
    await client.start();
  } catch (error) {
    logger.error("Failed to start Socket Mode client:", error);
    throw error;
  }
  logger.info("⚡️ Socket Mode runtime is running and listening for events");

  // Keep the process running
  // In Deno, we can use Deno.addSignalListener to handle graceful shutdown
  const handleShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await client.disconnect();
      logger.info("Disconnected from Slack");
      Deno.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      Deno.exit(1);
    }
  };

  Deno.addSignalListener("SIGINT", () => handleShutdown("SIGINT"));
  Deno.addSignalListener("SIGTERM", () => handleShutdown("SIGTERM"));
};

if (import.meta.main) {
  const appToken = Deno.env.get("SLACK_APP_TOKEN");
  if (!appToken) {
    console.error(
      "Error: SLACK_APP_TOKEN environment variable is required for Socket Mode",
    );
    Deno.exit(1);
  }

  const logLevelStr = Deno.env.get("SLACK_LOG_LEVEL") || "INFO";
  const logLevel = LogLevel[logLevelStr as keyof typeof LogLevel] ||
    LogLevel.INFO;

  const slackApiUrl = Deno.env.get("SLACK_API_URL");

  const hookCLI = getProtocolInterface(Deno.args);

  try {
    await runWithSocketMode(
      getManifest,
      hookCLI,
      {
        appToken,
        logLevel,
        slackApiUrl,
      },
    );
  } catch {
    Deno.exit(1);
  }
}
