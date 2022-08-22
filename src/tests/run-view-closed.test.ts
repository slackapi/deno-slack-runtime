import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { RunViewClosed } from "../run-view-closed.ts";
import { generateViewClosedPayload } from "./test_utils.ts";
import { UnhandledEventError } from "../run-unhandled-event.ts";
import { FunctionModule } from "../types.ts";

Deno.test("RunViewClosed function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunViewClosed);
  });

  await t.step("should run handler", async () => {
    const payload = generateViewClosedPayload();

    const viewClosedResp = {
      burp: "adurp",
    };

    const fnModule = {
      default: () => ({}),
      viewClosed: () => {
        return viewClosedResp;
      },
    };
    const resp = await RunViewClosed(payload, fnModule);

    assertEquals(resp, viewClosedResp);
  });

  await t.step("should run nested handler", async () => {
    const payload = generateViewClosedPayload();

    const viewClosedResp = {
      burp: "adurp",
    };

    const fnModule: FunctionModule = {
      default: () => ({}),
    };
    fnModule.viewClosed = () => {
      return viewClosedResp;
    };
    const resp = await RunViewClosed(payload, fnModule);

    assertEquals(resp, viewClosedResp);
  });

  await t.step("should run top level handler over nested handler", async () => {
    const payload = generateViewClosedPayload();

    const viewClosedResp = {
      burp: "adurp",
    };

    const fnModule: FunctionModule = {
      default: () => ({}),
      viewClosed: () => viewClosedResp,
    };
    fnModule.default.viewClosed = () => ({ no: "way" });

    const resp = await RunViewClosed(payload, fnModule);

    assertEquals(resp, viewClosedResp);
  });

  await t.step(
    "should return an empty resp if no handler defined",
    async () => {
      const payload = generateViewClosedPayload();

      const fnModule = {
        default: () => ({}),
      };

      await assertRejects(
        () => RunViewClosed(payload, fnModule),
        UnhandledEventError,
        "view_closed",
      );
    },
  );
});
