import { DispatchPayload } from "./dispatch-payload.ts";
import { InvocationPayload } from "./types.ts";
import { Application, Context, parse, Router } from "./deps.ts";

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

// Start a http server that listens on the provided port
// This server exposes two routes
//  GET  `/health`    Returns a 200 OK
//  POST `/functions` Accepts event payload and invokes `run`
const startServer = async function (port: number) {
  const router = new Router();
  router.get("/health", (ctx: Context) => {
    ctx.response.body = "OK";
  });
  router.post("/function", async (ctx: Context) => {
    // run the user code
    const body = ctx.request.body();
    const response = await run("functions", JSON.stringify(body.value));
    ctx.response.body = response;
  });

  const app = new Application();
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.addEventListener(
    "listen",
    (e) => console.log(`Listening on http://localhost:${port}`),
  );
  await app.listen({ port });
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
