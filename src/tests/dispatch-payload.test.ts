import { assertExists, assertRejects } from "../dev_deps.ts";
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
          context: { bot_access_token: "12345", variables: {} },
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
          context: { bot_access_token: "12345", variables: {} },
        }, () => [])
      );
    },
  );
});
