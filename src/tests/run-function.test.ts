import { assertEquals, assertExists, assertStringIncludes } from "../dev_deps.ts";
import { mockFetch } from "../dev_deps.ts";
import { RunFunction } from "../run-function.ts";
import { FAKE_ID, generatePayload } from "./test_utils.ts";

Deno.test("RunFunction function", async (t) => {
  
  await t.step("should be defined", () => {
    assertExists(RunFunction);
  });

  mockFetch.install(); // mock out calls to fetch
  await t.step(
    "should call completeError API if function fails to complete",
    async () => {
      mockFetch.mock("POST@/api/functions.completeError", async (req: Request) => {
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

  await t.step("should run handler", async () => {
    const outputs = { super: "dope" };

    const fnModule = {
      default: async () => {
        return await { outputs };
      },
    };

    const payload = generatePayload("someid");

    const resp = await RunFunction(payload, fnModule);

    const expected = { outputs: outputs };
    assertEquals(resp, expected);
  });

  await t.step(
    "should return an empty resp if run function fails",
    async () => {
      const payload = generatePayload("someid");

      mockFetch.mock("POST@/api/functions.completeSuccess", async (req: Request) => {
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
  mockFetch.uninstall();
});