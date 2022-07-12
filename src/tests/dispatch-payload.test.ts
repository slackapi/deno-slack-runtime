import { assertExists } from "../dev_deps.ts";
import { DispatchPayload } from "../dispatch-payload.ts";

Deno.test("DispatchPayload function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(DispatchPayload);
  });
});
