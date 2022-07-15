import { assertEquals, assertExists } from "../dev_deps.ts";
import { RunBlockAction } from "../run-block-actions.ts";
import { generateBlockActionsPayload } from "./test_utils.ts";

Deno.test("RunBlockAction function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunBlockAction);
  });

  await t.step("should run handler", async () => {
    const payload = generateBlockActionsPayload();

    const blockActionsResp = {
      burp: "adurp",
    };

    const fnModule = {
      default: () => ({}),
      blockActions: () => {
        return blockActionsResp;
      },
    };
    const resp = await RunBlockAction(payload, fnModule);

    assertEquals(resp, blockActionsResp);
  });

  await t.step(
    "should return an empty resp if no handler defined",
    async () => {
      const payload = generateBlockActionsPayload();

      const fnModule = {
        default: () => ({}),
      };
      const resp = await RunBlockAction(payload, fnModule);

      assertEquals(resp, {});
    },
  );
});
