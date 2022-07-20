import { DispatchPayload } from "./dispatch-payload.ts";
import { InvocationPayload } from "./types.ts";
import { parse } from "./deps.ts";

export const run = async function (functionDir: string, input: string) {
  // Directory containing functions must be provided when invoking this script.
  if (!functionDir) {
    throw new Error("Missing function-directory argument!");
  }
  functionDir = `file://${await Deno.realPath(functionDir)}`;

  // deno-lint-ignore no-explicit-any
  const payload: InvocationPayload<any> = JSON.parse(input);

  // For the hosted runtime, we only support js/ts files named w/ the callback_id
  // They should already be bundled into single files as part of the package uploaded
  const resp = await DispatchPayload(payload, (functionCallbackId) => {
    const supportedExts = ["js", "ts"];
    const potentialFunctionFiles = supportedExts.map((ext) =>
      `${functionDir}/${functionCallbackId}.${ext}`
    );

    return potentialFunctionFiles;
  });

  return JSON.stringify(resp || {});
};

// Start a http server that listens on the provided port
// This server exposes two routes
//  GET  `/health`    Returns a 200 OK
//  POST `/functions` Accepts event payload and invokes `run`
const startServer = async function (port: number) {
  let server;
  try {
    server = Deno.listen({ port });
  } catch (e) {
    throw new Error(`Unable to listen on ${port}, got ${e}`);
  }
  for await (const conn of server) {
    // In order to not be blocking, we need to handle each connection individually
    // without awaiting the function
    serveHttp(conn);
  }

  async function serveHttp(conn: Deno.Conn) {
    // This "upgrades" a network connection into an HTTP connection.
    const httpConn = Deno.serveHttp(conn);
    // Each request sent over the HTTP connection will be yielded as an async
    // iterator from the HTTP connection.
    for await (const requestEvent of httpConn) {
      // The native HTTP server uses the web standard `Request` and `Response`
      // objects.

      const url = new URL(requestEvent.request.url);
      // A health check route
      if (requestEvent.request.method == "GET" && url.pathname == "/health") {
        return requestEvent.respondWith(
          new Response("OK", {
            status: 200,
          }),
        );
      } else if (
        requestEvent.request.method == "POST" && url.pathname == "/functions"
      ) {
        const body = await requestEvent.request.text();
        try {
          // run the user code
          const response = await run(url.pathname.substring(1), body);
          return requestEvent.respondWith(
            new Response(response, {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        } catch (e) {
          console.error(`Unable to run user supplied module caught error ${e}`);
          requestEvent.respondWith(
            new Response(`error ${e}`, {
              status: 500,
            }),
          );
        }
      }
      // catch all for any unexpected route
      requestEvent.respondWith(
        new Response(
          `error unknown route ${requestEvent.request.method} ${url.pathname}`,
          { status: 404 },
        ),
      );
    }
  }
};

if (import.meta.main) {
  const args = parse(Deno.args);
  let port = 8080; // default port
  if (args.p !== undefined) {
    port = Number(args["p"]);
  }
  // catch non numbers for port
  if (!Number.isFinite(port)) {
    throw Error("port must be number");
  }

  await startServer(port);
}
