import { assertExists } from "../dev_deps.ts";
import { RunBlockAction } from "../run-block-actions.ts";

Deno.test("RunBlockAction function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunBlockAction);
  });
});
