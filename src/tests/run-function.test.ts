import {
  assertEquals,
  assertStringIncludes,
  mock,
  MockProtocol,
  Spy,
} from "../dev_deps.ts";
import { mockFetch } from "../dev_deps.ts";
import { RunFunction } from "../run-function.ts";
import { extractBaseHandlerArgsFromPayload } from "../dispatch-payload.ts";
import { FAKE_ID, generateFunctionExecutedPayload } from "./test_utils.ts";

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

      const args = extractBaseHandlerArgsFromPayload(
        generateFunctionExecutedPayload("someid"),
      );
      await RunFunction(args, {
        default: async () => {
          return await { error: "zomg!" };
        },
      }, MockProtocol());
    },
  );

  await t.step(
    "should call completeSuccess API if function successfully completes",
    async () => {
      const args = extractBaseHandlerArgsFromPayload(
        generateFunctionExecutedPayload("someid"),
      );
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
      }, MockProtocol());
    },
  );

  await t.step("debug mode enabled", async (tt) => {
    const evtPayload = generateFunctionExecutedPayload("someid");
    evtPayload.context.variables = { SLACK_DEBUG: "true" };

    await tt.step(
      "should log both request and response payloads to completeError if function fails to complete",
      async () => {
        mockFetch.mock(
          "POST@/api/functions.completeError",
          (_: Request) => {
            return new Response('{"ok":true}');
          },
        );

        const args = extractBaseHandlerArgsFromPayload(evtPayload);
        const mockProtocol = MockProtocol();
        const logSpy = mockProtocol.log as unknown as Spy;
        const functionOutput = { error: "zomg!" };
        await RunFunction(args, {
          default: async () => {
            return await functionOutput;
          },
        }, mockProtocol);
        mock.assertSpyCallArg(
          logSpy,
          0,
          0,
          "functions.completeError request payload:",
        );
        assertStringIncludes(
          logSpy.calls[0].args[1],
          `"error": "${functionOutput.error}"`,
        );
        mock.assertSpyCallArg(
          logSpy,
          1,
          0,
          "functions.completeError response payload:",
        );
        assertEquals(logSpy.calls[1].args[1].ok, true);
      },
    );
    await tt.step(
      "should log both request and response payloads to completeSuccess if function completes successfully",
      async () => {
        mockFetch.mock(
          "POST@/api/functions.completeSuccess",
          (_: Request) => {
            return new Response('{"ok":true}');
          },
        );

        const args = extractBaseHandlerArgsFromPayload(evtPayload);
        const mockProtocol = MockProtocol();
        const logSpy = mockProtocol.log as unknown as Spy;
        const functionOutput = { outputs: { super: "dope" } };
        await RunFunction(args, {
          default: async () => {
            return await functionOutput;
          },
        }, mockProtocol);
        mock.assertSpyCallArg(
          logSpy,
          0,
          0,
          "functions.completeSuccess request payload:",
        );
        assertStringIncludes(
          logSpy.calls[0].args[1],
          `"super": "dope"`,
        );
        mock.assertSpyCallArg(
          logSpy,
          1,
          0,
          "functions.completeSuccess response payload:",
        );
        assertEquals(logSpy.calls[1].args[1].ok, true);
      },
    );
  });

  mockFetch.uninstall();
});
