import { parse } from "./deps.ts";
import { getFunctionCallback, runWorker } from "./run-worker.ts";
import { ParseInvocationPayload } from "./parse-payload.ts";

// Start a http server that listens on the provided port
// This server exposes two routes
//  GET  `/health`    Returns a 200 OK
//  POST `/functions` Accepts event payload and invokes `run`
const startServer = async (port: number, timeout?: number) => {
  let server;
  try {
    server = Deno.listen({ port });
  } catch (e) {
    throw new Error(`Unable to listen on ${port}, got ${e}`);
  }
  console.log("Deno server started");
  for await (const conn of server) {
    // In order to not be blocking, we need to handle each connection individually
    // without awaiting the function
    serveHttp(conn);
  }

  async function serveHttp(conn: Deno.Conn) {
    console.log("serveHttp called);");
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
        console.log("/functions route called");
        const body = await requestEvent.request.text();
        console.log("body", body);
        try {
          // find the right function file to run
          const parsedPayload = ParseInvocationPayload(body);
          console.log("payload", parsedPayload);
          const functionCallbackID = getFunctionCallback(parsedPayload);
          console.log("functionCallbackID", functionCallbackID);

          const functionFile = `file://${await Deno.realPath(
            "/Users/brad.harris/dev/hermes-projects/interactive-approval/dist/functions",
            // "functions",
          )}/${functionCallbackID}.js`;

          console.log(
            "running worker",
            functionCallbackID,
            functionFile,
            parsedPayload,
            timeout,
          );
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

  let timeout: number | undefined;
  // Override timeout
  if (args.timeout) {
    timeout = Number(args.timeout);
    if (!Number.isFinite(timeout)) {
      throw Error("timeout must be a number");
    }
  }

  await startServer(port, timeout);
}
