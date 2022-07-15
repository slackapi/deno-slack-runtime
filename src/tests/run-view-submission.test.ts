import { assertEquals, assertExists } from "../dev_deps.ts";
import { RunViewSubmission } from "../run-view-submission.ts";
import { generateViewSubmissionPayload } from "./test_utils.ts";

Deno.test("RunViewSubmission function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunViewSubmission);
  });

  await t.step("should run handler", async () => {
    const payload = generateViewSubmissionPayload();

    const viewSubmissionResp = {
      burp: "adurp",
    };

    const fnModule = {
      default: () => ({}),
      viewSubmission: () => {
        return viewSubmissionResp;
      },
    };
    const resp = await RunViewSubmission(payload, fnModule);

    assertEquals(resp, viewSubmissionResp);
  });

  await t.step(
    "should return an empty resp if no handler defined",
    async () => {
      const payload = generateViewSubmissionPayload();

      const fnModule = {
        default: () => ({}),
      };
      const resp = await RunViewSubmission(payload, fnModule);

      assertEquals(resp, {});
    },
  );
});
