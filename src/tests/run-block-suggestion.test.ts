import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { RunBlockSuggestion } from "../run-block-suggestion.ts";
import { generateBlockSuggestionPayload } from "./test_utils.ts";
import { UnhandledEventError } from "../run-unhandled-event.ts";
import { FunctionModule } from "../types.ts";

const sampleOptionsResponse = {
  options: [
    {
      text: {
        type: "plain_text",
        text: "Give me your hand",
      },
      value: "AI-2323",
    },
    {
      text: {
        type: "plain_text",
        text: "Beauty and terror",
      },
      value: "SUPPORT-42",
    },
  ],
};

Deno.test("RunBlockSuggestion function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(RunBlockSuggestion);
  });

  await t.step("should run handler", async () => {
    const payload = generateBlockSuggestionPayload();

    const fnModule = {
      default: () => ({}),
      blockSuggestion: () => {
        return sampleOptionsResponse;
      },
    };
    const resp = await RunBlockSuggestion(payload, fnModule);

    assertEquals(resp, sampleOptionsResponse);
  });

  await t.step("should run nested handler", async () => {
    const payload = generateBlockSuggestionPayload();

    const fnModule: FunctionModule = {
      default: () => ({}),
    };
    fnModule.default.blockSuggestion = () => {
      return sampleOptionsResponse;
    };
    const resp = await RunBlockSuggestion(payload, fnModule);

    assertEquals(resp, sampleOptionsResponse);
  });

  await t.step("should run top level handler over nested handler", async () => {
    const payload = generateBlockSuggestionPayload();

    const fnModule: FunctionModule = {
      default: () => ({}),
      blockSuggestion: () => sampleOptionsResponse,
    };
    fnModule.default.blockSuggestion = () => ({
      no: "way",
    });

    const resp = await RunBlockSuggestion(payload, fnModule);

    assertEquals(resp, sampleOptionsResponse);
  });

  await t.step(
    "should throw an error if no handler defined",
    async () => {
      const payload = generateBlockSuggestionPayload();

      const fnModule = {
        default: () => ({}),
      };

      await assertRejects(
        () => RunBlockSuggestion(payload, fnModule),
        UnhandledEventError,
        "block_suggestion",
      );
    },
  );
});
