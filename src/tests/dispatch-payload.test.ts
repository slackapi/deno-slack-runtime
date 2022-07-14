import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { DispatchPayload } from "../dispatch-payload.ts";

Deno.test("DispatchPayload function", async (t) => {
  const origDir = Deno.cwd();
  const __dirname = new URL(".", import.meta.url).pathname;
  const fixturesDir = `${__dirname}/fixtures`;
  Deno.chdir(fixturesDir);
  const functionsDir = `${fixturesDir}/functions`;

  await t.step("should be defined", () => {
    assertExists(DispatchPayload);
  });

  await t.step(
    "return from provided file",
    async () => {
      const payload = {
        body: {
          event: {
            function: {
              callback_id: `${functionsDir}/wacky`,
            },
            type: "function_executed",
          },
        },
        context: {
          bot_access_token: "",
          variables: {},
        },
      };
      const fnModule = await DispatchPayload(payload, (functionCallbackId) => {
        return [`${functionCallbackId}.js`];
      });
      assertEquals(fnModule, {});
    },
  );

  await t.step(
    "file not found",
    async () => {
      const payload = {
        body: {
          event: {
            function: {
              callback_id: `${functionsDir}/funky`,
            },
            type: "function_executed",
          },
        },
        context: {
          bot_access_token: "",
          variables: {},
        },
      };
      await assertRejects(
        async () => {
          return await DispatchPayload(payload, (functionCallbackId) => {
            return [`${functionCallbackId}.js`];
          });
        },
        Error,
      );
    },
  );

  Deno.chdir(origDir);
});
