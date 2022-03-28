import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import sinon from "https://cdn.skypack.dev/sinon@11.1.2?dts";
import { SlackAPIClient } from "../client.ts";
import { RunFunction } from "../run-function.ts";
import { FAKE_ID, generatePayload } from "./test_utils.ts";

Deno.test("RunFunction function", async (t) => {
  const stub = sinon.stub(SlackAPIClient.prototype, "call").returns(
    Promise.resolve({ ok: true }),
  );
  await t.step(
    "should call completeError API if function fails to complete",
    async () => {
      const payload = generatePayload("someid");
      await RunFunction(payload, {
        default: async () => {
          return await { error: "zomg!" };
        },
      });
      const method = stub.firstCall.args[0];
      const data = stub.firstCall.args[1];
      assertEquals(
        method,
        "functions.completeError",
        "did not call completeError API",
      );
      assertEquals(
        data.error,
        "zomg!",
        "did not send function error to completeError API",
      );
      assertEquals(
        data.function_execution_id,
        FAKE_ID,
        "did not send function execution ID to completeError API",
      );
    },
  );

  await t.step(
    "should call completeSuccess API if function successfully completes",
    async () => {
      const payload = generatePayload("someid");
      const outputs = { super: "dope" };
      await RunFunction(payload, {
        default: async () => {
          return await { outputs };
        },
      });
      const method = stub.lastCall.args[0];
      const data = stub.lastCall.args[1];
      assertEquals(
        method,
        "functions.completeSuccess",
        "did not call completeSuccess API",
      );
      assertEquals(
        data.outputs,
        outputs,
        "did not send function outputs to completeSuccess API",
      );
      assertEquals(
        data.function_execution_id,
        FAKE_ID,
        "did not send function execution ID to completeSuccess API",
      );
    },
  );
});
