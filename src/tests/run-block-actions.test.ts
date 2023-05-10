import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { RunBlockAction } from "../run-block-actions.ts";
import { extractBaseHandlerArgsFromPayload } from "../dispatch-payload.ts";
import { generateBlockActionsPayload } from "./test_utils.ts";
import { UnhandledEventError } from "../run-unhandled-event.ts";
import { FunctionModule } from "../types.ts";

Deno.test("RunBlockAction function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunBlockAction);
  });

  await t.step("should run handler", async () => {
    const args = extractBaseHandlerArgsFromPayload(
      generateBlockActionsPayload(),
    );

    const blockActionsResp = {
      burp: "adurp",
    };

    const fnModule = {
      default: () => ({}),
      blockActions: () => {
        return blockActionsResp;
      },
    };
    const resp = await RunBlockAction(args, fnModule);

    assertEquals(resp, blockActionsResp);
  });

  await t.step("should run nested handler", async () => {
    const args = extractBaseHandlerArgsFromPayload(
      generateBlockActionsPayload(),
    );

    const blockActionsResp = {
      burp: "adurp",
    };

    const fnModule: FunctionModule = {
      default: () => ({}),
    };
    fnModule.default.blockActions = () => {
      return blockActionsResp;
    };
    const resp = await RunBlockAction(args, fnModule);

    assertEquals(resp, blockActionsResp);
  });

  await t.step("should run top level handler over nested handler", async () => {
    const args = extractBaseHandlerArgsFromPayload(
      generateBlockActionsPayload(),
    );

    const blockActionsResp = {
      burp: "adurp",
    };
    const fnModule: FunctionModule = {
      default: () => ({}),
      blockActions: () => blockActionsResp,
    };
    fnModule.default.blockActions = () => ({
      no: "way",
    });

    const resp = await RunBlockAction(args, fnModule);

    assertEquals(resp, blockActionsResp);
  });

  await t.step(
    "should throw an error if no handler defined",
    async () => {
      const args = extractBaseHandlerArgsFromPayload(
        generateBlockActionsPayload(),
      );

      const fnModule = {
        default: () => ({}),
      };

      await assertRejects(
        () => RunBlockAction(args, fnModule),
        UnhandledEventError,
        "block_actions",
      );
    },
  );
});
