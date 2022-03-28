import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std/testing/asserts.ts";
import { LoadFunctionModule } from "../load-function-module.ts";
import { generatePayload } from "./test_utils.ts";

Deno.test("LoadFunctionModule function", async (t) => {
  const origDir = Deno.cwd();
  const __dirname = new URL(".", import.meta.url).pathname;
  Deno.chdir(`${__dirname}/fixtures`);

  await t.step("should load typescript file if exists", async () => {
    const tsModule = await LoadFunctionModule(generatePayload("funky"));
    assertEquals(
      tsModule.default.name,
      "funkyTS",
      "typescript file not loaded",
    );
  });
  await t.step("should load javascript file if exists", async () => {
    const jsModule = await LoadFunctionModule(generatePayload("wacky"));
    assertEquals(
      jsModule.default.name,
      "wackyJS",
      "javascript file not loaded",
    );
  });
  await t.step("should throw if does not exist", async () => {
    await assertRejects(async () => {
      return await LoadFunctionModule(generatePayload("nonexistent"));
    });
  });

  Deno.chdir(origDir);
});
