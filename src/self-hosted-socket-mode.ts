import {
  ConsoleLogger,
  getManifest,
  getProtocolInterface,
  LogLevel,
  Protocol,
  SocketModeClient,
  type Logger,
} from "./deps.ts";
import { DispatchPayload } from "./dispatch-payload.ts";
import type { InvocationPayload } from "./types.ts";

export interface SocketModeRunOptions {
  appToken: string;
  logger?: Logger;
  logLevel?: LogLevel;
  slackApiUrl?: string;
}

/**
 * @description Runs an application in Socket Mode by establishing a WebSocket
 * connection to Slack and listening for function_executed events continuously.
 */
export const runWithSocketMode = async function (
  create: typeof getManifest,
  dispatch: typeof DispatchPayload,
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
    logger.warn(
      `No function definitions found in the manifest: ${manifest.functions}`,
    );
  }

  // Create Socket Mode client with optional dev instance support
  const clientOptions = slackApiUrl ? { slackApiUrl } : undefined;
  const client = new SocketModeClient({
    appToken,
    logLevel,
    logger,
    clientOptions,
  });

  // Listen for incoming events
  client.on("slack_event", async (args: {
    // deno-lint-ignore no-explicit-any
    body: any;
    ack: (response?: Record<string, unknown>) => Promise<void>;
    retry_num?: number;
    retry_reason?: string;
  }) => {
    const { body, ack, retry_num, retry_reason } = args;

    logger.debug("Received slack_event:", JSON.stringify(body, null, 2));

    try {
      // Convert the Socket Mode event into an InvocationPayload format
      // that the existing dispatch-payload system expects
      // deno-lint-ignore no-explicit-any
      const payload: InvocationPayload<any> = {
        body,
        context: {
          bot_access_token: body.event?.bot_access_token || body.bot_access_token || "",
          team_id: body.team_id || "",
          variables: Deno.env.toObject(),
        },
      };

      // Add retry information if present
      if (retry_num !== undefined) {
        logger.warn(`Retrying event (attempt ${retry_num})${retry_reason ? `: ${retry_reason}` : ""}`);
      }

      // Dispatch the payload to the appropriate function handler
      const resp = await dispatch(payload, hookCLI, (functionCallbackId) => {
        const functionDefn = manifest.functions[functionCallbackId];
        if (!functionDefn) {
          throw new Error(
            `No function definition for function callback id ${functionCallbackId} was found in the manifest! manifest.functions: ${
              Object.keys(manifest.functions).join(", ")
            }`,
          );
        }

        const functionFile = `file://${workingDirectory}/${functionDefn.source_file}`;
        logger.debug(`Loading function from: ${functionFile}`);
        return functionFile;
      });

      // Acknowledge the event with optional response payload
      await ack(resp || {});
      logger.debug("Event processed and acknowledged");
    } catch (error) {
      logger.error("Error processing event:", error);
      // Still acknowledge to prevent retries for unrecoverable errors
      // You might want to customize this behavior based on error type
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
  await client.start();
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

  // Parse log level from environment
  const logLevelStr = Deno.env.get("SLACK_LOG_LEVEL") || "INFO";
  const logLevel = LogLevel[logLevelStr as keyof typeof LogLevel] || LogLevel.INFO;

  // Support for dev Slack instances
  const slackApiUrl = Deno.env.get("SLACK_API_URL");

  const hookCLI = getProtocolInterface(Deno.args);

  await runWithSocketMode(
    getManifest,
    DispatchPayload,
    hookCLI,
    {
      appToken,
      logLevel,
      slackApiUrl,
    },
  );
}
