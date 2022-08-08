import { DispatchPayload } from "./dispatch-payload.ts";
import { InvocationPayload } from "./types.ts";
import { parse, serve } from "./deps.ts";

export const run = async function (functionDir: string, input: string) {
  // Directory containing functions must be provided when invoking this script.
  if (!functionDir) {
    throw new Error("Missing function-directory argument!");
  }
  functionDir = `file://${await Deno.realPath(functionDir)}`;

  // deno-lint-ignore no-explicit-any
  const payload: InvocationPayload<any> = JSON.parse(input);

  // For the hosted runtime, we only support js files named w/ the callback_id
  // They should already be bundled into single files as part of the package uploaded
  const resp = await DispatchPayload(payload, (functionCallbackId) => {
    return [`${functionDir}/${functionCallbackId}.js`];
  });

  return resp || {};
};

const handleRequest = async (request: Request) => {
  const url = new URL(request.url);

  // A health check route
  if (request.method == "GET" && url.pathname == "/health") {
    return new Response("OK", {
      status: 200,
    });
  } else if (
    request.method == "POST" && url.pathname == "/functions"
  ) {
    const body = await request.text();

    try {
      // run the user code
      const response = await run("functions", body);

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error(`Unable to run user supplied module caught error ${e}`);

      return new Response(`error ${e}`, {
        status: 500,
      });
    }
  } else {
    // catch all for any unexpected route
    return new Response(
      `error unknown route ${request.method} ${url.pathname}`,
      { status: 404 },
    );
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

  await serve(handleRequest, { port });
}
