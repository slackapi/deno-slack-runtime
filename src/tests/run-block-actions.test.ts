import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { RunBlockAction } from "../run-block-actions.ts";
import { generateBlockActionsPayload } from "./test_utils.ts";
import { UnhandledEventError } from "../run-unhandled-event.ts";

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
    "should throw an error if no handler defined",
    async () => {
      const payload = generateBlockActionsPayload();

      const fnModule = {
        default: () => ({}),
      };

      await assertRejects(
        () => RunBlockAction(payload, fnModule),
        UnhandledEventError,
        "block_actions",
      );
    },
  );
});
