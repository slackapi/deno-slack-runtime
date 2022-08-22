import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { RunUnhandledEvent } from "../run-unhandled-event.ts";
import { generateBaseInvocationBody } from "./test_utils.ts";

Deno.test("RunUnhandledEvent function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunUnhandledEvent);
  });

  await t.step("should run handler", async () => {
    const payload = generateBaseInvocationBody("something");

    const fnModule = {
      default: () => ({}),
      unhandledEvent: () => ({ ok: true }),
    };
    const resp = await RunUnhandledEvent(payload, fnModule);

    assertEquals(resp, { ok: true });
  });

  await t.step(
    "should throw an error if no handler defined",
    async () => {
      const payload = generateBaseInvocationBody("test_type");

      const fnModule = {
        default: () => ({}),
      };

      await assertRejects(
        () => RunUnhandledEvent(payload, fnModule),
        Error,
        "unhandledEvent",
      );
    },
  );
});
