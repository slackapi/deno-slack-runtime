import { DispatchPayload } from "./dispatch-payload.ts";
import { InvocationPayload } from "./types.ts";
import { parse, Protocol } from "./deps.ts";

/**
 * This module should only be used by Run On Slack Infrastructure
 * The Slack backend this module's code runs on has explicit expectations on how information sent to stdout and stderr are handled by Slack.
 */
export const run = async function (functionDir: string, input: string) {
  // Directory containing functions must be provided when invoking this script.
  if (!functionDir) {
    throw new Error("Missing function-directory argument!");
  }
  functionDir = `file://${await Deno.realPath(functionDir)}`;

  // deno-lint-ignore no-explicit-any
  const payload: InvocationPayload<any> = JSON.parse(input);

  // Dummy protocol interface object that just directs relevant log/warn/error logging
  // to their usual locations; not relevant for ROSI apps, thus we provide this simple wrapper
  const hookCLI: Protocol = {
    name: "ROSIProtocol",
    log: console.log,
    warn: console.warn,
    error: console.error,
    respond: () => {},
  };
  // For the hosted runtime, we only support js files named w/ the callback_id
  // They should already be bundled into single files as part of the package uploaded
  // See the deno-slack-hooks repo for how the bundling and package is done
  const resp = await DispatchPayload(
    payload,
    hookCLI,
    (functionCallbackId) => {
      return `${functionDir}/${functionCallbackId}.js`;
    },
  );

  return resp || {};
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
    // TODO: we should move to `Deno.serve` once it is stable instead of `Deno.serveHttp()` https://docs.deno.com/runtime/reference/migration_guide/
    // @ts-ignore `Deno.serveHttp()` is soft-removed as of Deno 2.
    // deno-lint-ignore no-deprecated-deno-api
    const httpConn = Deno.serveHttp(conn);
    // Each request sent over the HTTP connection will be yielded as an async
    // iterator from the HTTP connection.
    for await (const requestEvent of httpConn) {
      // The native HTTP server uses the web standard `Request` and `Response`
      // objects.

      const url = new URL(requestEvent.request.url);
      // A health check route
      if (requestEvent.request.method == "GET" && url.pathname == "/health") {
        await requestEvent.respondWith(
          new Response("OK", {
            status: 200,
          }),
        ).catch((e) =>
          console.log(`Uncaught exception during health check: ${e}`)
        );
      } else if (
        requestEvent.request.method == "POST" && url.pathname == "/functions"
      ) {
        // TODO: does the following need to be wrapped in a try/catch too?
        // I think the await text() processes the read stream of the request
        // Could probably blow up if the connection is interrupted
        // TODO: I think we want to be intentional about how we use try/catch here.
        // The in-line promise catch() would only catch issues responding to the
        // request. The wrapping try{} would catch either userland function exceptions
        // or JSON stringification of userland response.
        const body = await requestEvent.request.text();
        try {
          // run the user code
          const response = await run("functions", body);
          await requestEvent.respondWith(
            new Response(JSON.stringify(response), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          ).catch((e) =>
            // TODO: where would this log show up? Since this runs on Slack hosting in a lambda context
            console.log(
              `Error responding HTTP 200 to webapp request after running user code: ${e}`,
            )
          );
        } catch (e) {
          const loggable = e.stack ? e.stack : e;
          console.error(
            `Caught error from user supplied module: ${loggable}`,
          );
          await requestEvent.respondWith(
            new Response(`error ${e}`, {
              status: 500,
            }),
          ).catch((e) =>
            console.log(`Error responding HTTP 500 to webapp request: ${e}`)
          );
        }
      } else {
        // catch all for any unexpected route
        await requestEvent.respondWith(
          new Response(
            `error unknown route ${requestEvent.request.method} ${url.pathname}`,
            { status: 404 },
          ),
        ).catch((e) =>
          console.log(
            `Error responding HTTP 404 to webapp request calling unexpected route: ${e}`,
          )
        );
      }
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
