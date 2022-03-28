import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std/testing/asserts.ts";
import { ParsePayload } from "../parse-payload.ts";

const fakeStdin = (contents: string) => {
  return async () => {
    return await new TextEncoder().encode(contents);
  };
};

Deno.test("ParsePayload function", async (t) => {
  await t.step("should parse valid JSON", async () => {
    const json = "{}";
    assertEquals(
      JSON.stringify(await ParsePayload(fakeStdin(json))),
      json,
      "Successfully decoded an empty JSON object",
    );
  });
  await t.step("should throw if invalid JSON encountered", async () => {
    const json = ":/";
    await assertRejects(async () => {
      return await ParsePayload(fakeStdin(json));
    });
  });
});
