import { readAll } from "./deps.ts";
import { ParsePayload } from "./parse-payload.ts";
import { DispatchPayload } from "./dispatch-payload.ts";
import { InvocationPayload } from "./types.ts";

export const run = async function (functionDir: string, input: string) {
  // Directory containing functions must be provided when invoking this script.
  if (!functionDir) {
    throw new Error("Missing function-directory argument!");
  }
  functionDir = `file://${await Deno.realPath(functionDir)}`;

  // const payload = await ParsePayload(readAll);
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

  // The CLI expects a JSON payload to be output to stdout
  // This is formalized in the `run` hook of the CLI/SDK Tech Spec:
  // https://corp.quip.com/0gDvAsqoaaYE/Proposal-CLI-SDK-Interface#temp:C:fOC1991c5aec8994d0db01d26260
  console.log(JSON.stringify(resp || {}));
};

const server = Deno.listen({ port: 8080 });
console.log("Server listening on 8080");

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
    console.log(`requestEvent is: ${requestEvent.request.url}`);
    const url = new URL(requestEvent.request.url);
    const body = await requestEvent.request.text();
    run(url.pathname.substring(1), body);
    // The requestEvent's `.respondWith()` method is how we send the response
    // back to the client.
    requestEvent.respondWith(
      new Response(body, {
        status: 200,
      }),
    );
  }
}

// if (import.meta.main) {
//   await run(Deno.args[0]);
// }
