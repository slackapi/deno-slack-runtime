import { assertEquals, assertStringIncludes } from "../dev_deps.ts";
import { mockFetch } from "../dev_deps.ts";
import { RunFunction } from "../run-function.ts";
import { extractBaseHandlerArgsFromPayload } from "../dispatch-payload.ts";
import { FAKE_ID, generatePayload } from "./test_utils.ts";

Deno.test("RunFunction function", async (t) => {
  mockFetch.install(); // mock out calls to fetch
  await t.step(
    "should call completeError API if function fails to complete",
    async () => {
      mockFetch.mock(
        "POST@/api/functions.completeError",
        async (req: Request) => {
          assertEquals(
            req.url,
            "https://slack.com/api/functions.completeError",
          );
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
        },
      );

      const args = extractBaseHandlerArgsFromPayload(generatePayload("someid"));
      await RunFunction(args, {
        default: async () => {
          return await { error: "zomg!" };
        },
      });
    },
  );

  await t.step(
    "should call completeSuccess API if function successfully completes",
    async () => {
      const args = extractBaseHandlerArgsFromPayload(generatePayload("someid"));
      const outputs = { super: "dope" };

      mockFetch.mock(
        "POST@/api/functions.completeSuccess",
        async (req: Request) => {
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
        },
      );

      await RunFunction(args, {
        default: async () => {
          return await { outputs };
        },
      });
    },
  );
  mockFetch.uninstall();
});
