import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { RunUnhandledEvent } from "../run-unhandled-event.ts";
import { extractBaseHandlerArgsFromPayload } from "../dispatch-payload.ts";
import { generateBaseInvocationBody } from "./test_utils.ts";

Deno.test("RunUnhandledEvent function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunUnhandledEvent);
  });

  await t.step("should run handler", async () => {
    const args = extractBaseHandlerArgsFromPayload(
      generateBaseInvocationBody("something"),
    );

    const fnModule = {
      default: () => ({}),
      unhandledEvent: () => ({ ok: true }),
    };
    const resp = await RunUnhandledEvent(args, fnModule);

    assertEquals(resp, { ok: true });
  });

  await t.step("should run nested handler", async () => {
    const args = extractBaseHandlerArgsFromPayload(
      generateBaseInvocationBody("something"),
    );

    // deno-lint-ignore no-explicit-any
    const fnModule: any = {
      default: () => ({}),
    };
    fnModule.default.unhandledEvent = () => ({ ok: true });

    const resp = await RunUnhandledEvent(args, fnModule);

    assertEquals(resp, { ok: true });
  });

  await t.step("should run top level handler over nested handler", async () => {
    const args = extractBaseHandlerArgsFromPayload(
      generateBaseInvocationBody("something"),
    );

    // deno-lint-ignore no-explicit-any
    const fnModule: any = {
      default: () => ({}),
      unhandledEvent: () => ({ ok: true }),
    };
    fnModule.default.unhandledEvent = () => ({ ok: false });

    const resp = await RunUnhandledEvent(args, fnModule);

    assertEquals(resp, { ok: true });
  });

  await t.step(
    "should throw an error if no handler defined",
    async () => {
      const args = extractBaseHandlerArgsFromPayload(
        generateBaseInvocationBody("something"),
      );

      const fnModule = {
        default: () => ({}),
      };

      await assertRejects(
        () => RunUnhandledEvent(args, fnModule),
        Error,
        "unhandledEvent",
      );
    },
  );
});
