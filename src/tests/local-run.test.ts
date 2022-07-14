import { assertExists } from "../dev_deps.ts";
import { runLocally } from "../local-run.ts";

Deno.test("runLocally function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(runLocally);
  });
});
