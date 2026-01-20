import { getManifest, getProtocolInterface, Protocol } from "./deps.ts";
import { DispatchPayload } from "./dispatch-payload.ts";
import type { InvocationPayload } from "./types.ts";

/**
 * HTTP receiver options aligned with Bolt for JavaScript (bolt-js) HTTPReceiver.
 * @see https://github.com/slackapi/bolt-js/blob/main/src/receivers/HTTPReceiver.ts
 *
 * Slack API calls from the runtime (e.g. in run-function) use BaseSlackAPIClient
 * from the deno_slack_api package.
 */
export interface HTTPReceiverOptions {
  /** Signing secret from Slack app credentials (required for request verification). */
  signingSecret: string;
  /** Port to listen on. Default: 3000. */
  port?: number;
  /** Event endpoint path(s). Default: ["/slack/events", "/events"]. */
  endpoints?: string | string[];
  /** Verify request signature with signing secret. Default: true. */
  signatureVerification?: boolean;
  /** Override Slack API base URL (e.g. for dev instances). */
  slackApiUrl?: string;
}

/**
 * Constant-time string comparison to mitigate timing attacks (aligned with bolt-js verify-request).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifies the signature of an incoming request from Slack using HMAC SHA256.
 * Behavior aligned with bolt-js HTTPReceiver / verify-request.
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 * @see https://github.com/slackapi/bolt-js/blob/main/src/receivers/verify-request.ts
 */
async function verifySlackRequest(
  signingSecret: string,
  body: string,
  headers: Headers,
): Promise<boolean> {
  const signature = headers.get("x-slack-signature");
  const timestamp = headers.get("x-slack-request-timestamp");

  if (!signature || !timestamp) {
    return false;
  }

  const requestTimestamp = Number.parseInt(timestamp, 10);
  if (Number.isNaN(requestTimestamp)) {
    return false;
  }

  // Check if request is stale (older than 5 minutes), same as bolt-js
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (requestTimestamp < fiveMinutesAgo) {
    return false;
  }

  const [version, signatureHash] = signature.split("=");
  if (version !== "v0" || !signatureHash) {
    return false;
  }

  const sigBaseString = `${version}:${timestamp}:${body}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingSecret);
  const messageData = encoder.encode(sigBaseString);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData,
  );
  const computedHash = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computedHash, signatureHash);
}

/**
 * Runs the app as an HTTP server that accepts Slack events via POST to the
 * configured endpoints. Request handling (verify → parse → ssl_check →
 * url_verification → event dispatch) is aligned with Bolt for JavaScript
 * HTTPReceiver. Handler code uses BaseSlackAPIClient from deno_slack_api for
 * Slack API calls (e.g. functions.completeSuccess in run-function).
 *
 * @see https://github.com/slackapi/bolt-js (HTTPReceiver)
 */
export const runWithHTTPReceiver = async function (
  create: typeof getManifest,
  dispatch: typeof DispatchPayload,
  hookCLI: Protocol,
  options: HTTPReceiverOptions,
): Promise<void> {
  const {
    signingSecret,
    port = 3000,
    endpoints = ["/slack/events", "/events"],
    signatureVerification = true,
    slackApiUrl,
  } = options;

  // Normalize endpoints to array
  const eventEndpoints = Array.isArray(endpoints) ? endpoints : [endpoints];

  // Load the manifest to get function definitions
  const workingDirectory = Deno.cwd();
  const manifest = await create(workingDirectory);

  if (!manifest.functions) {
    throw new Error(
      `No function definitions were found in the manifest! manifest.functions: ${manifest.functions}`,
    );
  }

  hookCLI.log(
    `Loaded manifest with functions: ${
      Object.keys(manifest.functions).join(", ")
    }`,
  );

  // Store env for passing to handlers
  const env = Deno.env.toObject();
  if (slackApiUrl) {
    env["SLACK_API_URL"] = slackApiUrl;
  }

  // Request handler
  const handler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health check endpoint
    if (request.method === "GET" && pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    // Event endpoints
    if (request.method === "POST" && eventEndpoints.includes(pathname)) {
      try {
        const body = await request.text();

        // Verify request signature
        if (signatureVerification) {
          const isValid = await verifySlackRequest(
            signingSecret,
            body,
            request.headers,
          );
          if (!isValid) {
            hookCLI.warn("Invalid request signature");
            return new Response("Invalid signature", { status: 401 });
          }
        }

        // Parse the body
        // deno-lint-ignore no-explicit-any
        const parsedBody: any = JSON.parse(body);

        // Log incoming event
        const eventType = parsedBody.type || parsedBody.event?.type ||
          "unknown";
        const eventId = parsedBody.event_id || "no-id";
        hookCLI.log(`📨 Received event: ${eventType} (${eventId})`);

        // Handle URL verification challenge
        if (parsedBody.type === "url_verification") {
          hookCLI.log("✅ Responding to URL verification challenge");
          return new Response(
            JSON.stringify({ challenge: parsedBody.challenge }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // Handle SSL check
        if (parsedBody.ssl_check === "1") {
          hookCLI.log("🔒 SSL check request");
          return new Response("OK", { status: 200 });
        }

        // Extract retry information
        const retryNum = request.headers.get("x-slack-retry-num");
        const retryReason = request.headers.get("x-slack-retry-reason");
        if (retryNum) {
          hookCLI.warn(
            `🔄 Retry attempt ${retryNum}${
              retryReason ? `: ${retryReason}` : ""
            }`,
          );
        }

        // Log additional event details
        if (parsedBody.event) {
          const { type, user, channel, ts } = parsedBody.event;
          hookCLI.log(
            `   Event details: type=${type}${user ? `, user=${user}` : ""}${
              channel ? `, channel=${channel}` : ""
            }${ts ? `, ts=${ts}` : ""}`,
          );
        }

        // Log function callback_id if present
        const callbackId = parsedBody.event?.function?.callback_id ||
          parsedBody.function_data?.function?.callback_id;
        if (callbackId) {
          hookCLI.log(`   Function: ${callbackId}`);
        }

        // Convert to InvocationPayload format
        // deno-lint-ignore no-explicit-any
        const payload: InvocationPayload<any> = {
          body: parsedBody,
          context: {
            bot_access_token: parsedBody.event?.bot_access_token ||
              parsedBody.bot_access_token || "",
            team_id: parsedBody.team_id || "",
            variables: env,
          },
        };

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

          const functionFile =
            `file://${workingDirectory}/${functionDefn.source_file}`;
          return functionFile;
        });

        // Return response
        hookCLI.log(`✓ Event processed successfully`);

        if (resp && Object.keys(resp).length > 0) {
          hookCLI.log(`   Response: ${JSON.stringify(resp)}`);
          return new Response(JSON.stringify(resp), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response("", { status: 200 });
      } catch (error) {
        hookCLI.error("❌ Error processing event:", error);
        if (error instanceof Error && error.stack) {
          hookCLI.error(error.stack);
        }
        return new Response(
          JSON.stringify({ error: String(error) }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // 404 for unknown routes
    return new Response("Not Found", { status: 404 });
  };

  // Start the server
  hookCLI.log(`🚀 Starting HTTP server on port ${port}`);
  hookCLI.log(`📡 Event endpoints: ${eventEndpoints.join(", ")}`);
  hookCLI.log(`🏥 Health check: /health`);

  const server = Deno.serve({
    port,
    onListen: ({ hostname, port }) => {
      hookCLI.log(`⚡️ HTTP receiver listening on http://${hostname}:${port}`);
      hookCLI.log(`\n💡 To test with Slack:`);
      hookCLI.log(`   1. Expose this server with ngrok: ngrok http ${port}`);
      hookCLI.log(
        `   2. Set Event Request URL in your Slack app to: https://your-ngrok-url${
          eventEndpoints[0]
        }`,
      );
    },
  }, handler);

  // Handle graceful shutdown
  const handleShutdown = async (signal: string) => {
    hookCLI.log(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await server.shutdown();
      hookCLI.log("Server stopped");
      Deno.exit(0);
    } catch (error) {
      hookCLI.error("Error during shutdown:", error);
      Deno.exit(1);
    }
  };

  Deno.addSignalListener("SIGINT", () => handleShutdown("SIGINT"));
  Deno.addSignalListener("SIGTERM", () => handleShutdown("SIGTERM"));

  // Wait for the server to finish
  await server.finished;
};

if (import.meta.main) {
  const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
  if (!signingSecret) {
    console.error(
      "Error: SLACK_SIGNING_SECRET environment variable is required",
    );
    console.error(
      "Get it from: https://api.slack.com/apps → Your App → Basic Information → App Credentials",
    );
    Deno.exit(1);
  }

  const port = Deno.env.get("PORT")
    ? Number.parseInt(Deno.env.get("PORT")!, 10)
    : 3000;

  const signatureVerification =
    Deno.env.get("SLACK_SIGNATURE_VERIFICATION") !== "false";
  const slackApiUrl = Deno.env.get("SLACK_API_URL");

  const hookCLI = getProtocolInterface(Deno.args);

  await runWithHTTPReceiver(
    getManifest,
    DispatchPayload,
    hookCLI,
    {
      signingSecret,
      port,
      signatureVerification,
      slackApiUrl,
    },
  );
}
