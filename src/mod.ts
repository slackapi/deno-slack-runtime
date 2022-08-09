import { parse } from "./deps.ts";
import { getFunctionCallback, runWorker } from "./run-worker.ts";
import { ParseInvocationPayload } from "./parse-payload.ts";

const DEFAULT_WORKER_TIMEOUT = 15 * 60 * 1000;

// Start a http server that listens on the provided port
// This server exposes two routes
//  GET  `/health`    Returns a 200 OK
//  POST `/functions` Accepts event payload and invokes `run`
const startServer = async (port: number, timeout: number) => {
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
        const body = await requestEvent.request.text();
        try {
          // find the right function file to run
          const parsedPayload = ParseInvocationPayload(body);
          const functionCallbackID = getFunctionCallback(parsedPayload);
          const functionFile = `file://${await Deno.realPath(
            "functions",
          )}/${functionCallbackID}.js`;

          // run the user code
          const response = await runWorker(
            functionCallbackID,
            functionFile,
            parsedPayload,
            timeout,
          );
          await requestEvent.respondWith(
            new Response(JSON.stringify(response), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          ).catch((e) =>
            console.log(`Uncaught exception after running user code: ${e}`)
          );
        } catch (e) {
          console.error(`Unable to run user supplied module caught error ${e}`);
          await requestEvent.respondWith(
            new Response(`error ${e}`, {
              status: 500,
            }),
          ).catch((e) => console.log(`Uncaught exception: ${e}`));
        }
      } else {
        // catch all for any unexpected route
        await requestEvent.respondWith(
          new Response(
            `error unknown route ${requestEvent.request.method} ${url.pathname}`,
            { status: 404 },
          ),
        ).catch((e) =>
          console.log(`Uncaught exception on calling unexpected routes: ${e}`)
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

  let timeout = DEFAULT_WORKER_TIMEOUT;
  // Override timeout
  if (args.timeout) {
    timeout = Number(args.timeout);
  }
  if (!Number.isFinite(timeout)) {
    throw Error("timeout must be a number");
  }

  await startServer(port, timeout);
}
