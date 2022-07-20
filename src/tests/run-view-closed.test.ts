import { assertEquals, assertExists } from "../dev_deps.ts";
import { RunViewClosed } from "../run-view-closed.ts";
import { generateViewClosedPayload } from "./test_utils.ts";

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

  await t.step(
    "should return an empty resp if no handler defined",
    async () => {
      const payload = generateViewClosedPayload();

      const fnModule = {
        default: () => ({}),
      };
      const resp = await RunViewClosed(payload, fnModule);

      assertEquals(resp, {});
    },
  );
});
