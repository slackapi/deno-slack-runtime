import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { DispatchPayload } from "../dispatch-payload.ts";

Deno.test("DispatchPayload function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(DispatchPayload);
  });
  await t.step(
    "should throw if an unrecognized event type is dispatched",
    async () => {
      await assertRejects(() =>
        DispatchPayload({
          body: { type: "messinwitcha" },
          context: { bot_access_token: "12345", team_id: "123", variables: {} },
        }, () => [])
      );
    },
  );
  await t.step(
    "should throw if no function callback_id present in payload",
    async () => {
      await assertRejects(() =>
        DispatchPayload({
          body: { type: "function_executed", event: {} },
          context: { bot_access_token: "12345", team_id: "123", variables: {} },
        }, () => [])
      );
    },
  );
});
Deno.test("DispatchPayload function file compatibility tests", async (t) => {
  const origDir = Deno.cwd();
  const __dirname = new URL(".", import.meta.url).pathname;
  const fixturesDir = `${__dirname}/fixtures`;
  Deno.chdir(fixturesDir);
  const functionsDir = `${fixturesDir}/functions`;

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
          team_id: "",
          variables: {},
        },
      };
      const fnModule = await DispatchPayload(
        payload,
        (functionCallbackId) => {
          return [`${functionCallbackId}.js`];
        },
      );
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
          team_id: "",
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
