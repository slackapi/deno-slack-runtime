import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "../dev_deps.ts";
import { callCompleteAPI, runLocally } from "../local-run.ts";
import * as mf from "../dev_deps.ts";
import { FAKE_ID, generatePayload } from "./test_utils.ts";

Deno.test("runLocally function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(runLocally);
  });

  await t.step("should be defined", () => {
    assertExists(callCompleteAPI);
  });
});

Deno.test("call CompleteSuccess/Error API function", async (t) => {
  mf.install(); // mock out calls to fetch

  await t.step(
    "should call completeSuccess API if function successfully completes",
    async () => {
      const payload = generatePayload("someid");
      const outputs = { super: "dope" };

      mf.mock("POST@/api/functions.completeSuccess", async (req: Request) => {
        assertEquals(
          req.url,
          "https://slack.com/api/functions.completeSuccess",
        );
        const requestBody = await req.text();
        assertStringIncludes(
          requestBody,
          `function_execution_id=${FAKE_ID}`,
        );
        return new Response('{"ok":true}');
      });

      await callCompleteAPI(payload, {
        default: async () => {
          return await { outputs };
        },
      });
    },
  );

  mf.uninstall();
});
