import { assertEquals, assertStringIncludes } from "../dev_deps.ts";
import * as mf from "../dev_deps.ts";
import { RunFunction } from "../run-function.ts";
import { FAKE_ID, generatePayload } from "./test_utils.ts";

Deno.test("RunFunction function", async (t) => {
  mf.install(); // mock out calls to fetch
  await t.step(
    "should call completeError API if function fails to complete",
    async () => {
      mf.mock("POST@/api/functions.completeError", async (req: Request) => {
        assertEquals(req.url, "https://slack.com/api/functions.completeError");
        const requestBody = await req.text();
        assertStringIncludes(
          requestBody,
          "error=zomg%21",
        );
        assertStringIncludes(
          requestBody,
          `function_execution_id=${FAKE_ID}`,
        );
        return new Response('{"ok":true}');
      });

      const payload = generatePayload("someid");
      await RunFunction(payload, {
        default: async () => {
          return await { error: "zomg!" };
        },
      });
    },
  );

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
          `outputs=${encodeURIComponent(JSON.stringify(outputs))}`,
        );
        assertStringIncludes(
          requestBody,
          `function_execution_id=${FAKE_ID}`,
        );
        return new Response('{"ok":true}');
      });

      await RunFunction(payload, {
        default: async () => {
          return await { outputs };
        },
      });
    },
  );
  mf.uninstall();
});
