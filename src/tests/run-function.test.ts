import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { RunFunction } from "../run-function.ts";
import { generatePayload } from "./test_utils.ts";
import { UnhandledEventError } from "../run-unhandled-event.ts";

Deno.test("RunFunction function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunFunction);
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
      const errors = { error: "zomg!" };

      const errorFnModule = {
        default: async () => {
          return await errors;
        },
      };

      const payload = generatePayload("someid");

      const resp = await RunFunction(payload, errorFnModule);

      assertEquals(resp, errors);
    },
  );

  await t.step(
    "should return an empty resp if no handler defined",
    async () => {
      const payload = generatePayload("someid");

      const fnModule = {
        unhandledEvent: () => ({}),
      };

      await assertRejects(
        () => RunFunction(payload, fnModule),
        UnhandledEventError,
        "function_executed",
      );
    },
  );
});
