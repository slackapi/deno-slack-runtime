import {
  assertEquals,
  assertExists,
  assertRejects,
  semver,
} from "../dev_deps.ts";
import { LoadFunctionModule } from "../load-function-module.ts";

Deno.test("LoadFunctionModule function", async (t) => {
  const parsedDenoVersion = semver.parse(Deno.version.deno);
  const origDir = Deno.cwd();
  const __dirname = new URL(".", import.meta.url).pathname;
  const fixturesDir = `${__dirname}/fixtures`;
  Deno.chdir(fixturesDir);
  const functionsDir = `${fixturesDir}/functions`;

  await t.step("should load typescript file if exists", async () => {
    const tsModule = await LoadFunctionModule(`${functionsDir}/funky.ts`);
    assertExists(tsModule);
    assertEquals(
      tsModule.default?.name,
      "funkyTS",
      "typescript file not loaded",
    );
  });

  await t.step("should load javascript file if exists", async () => {
    const jsModule = await LoadFunctionModule(`${functionsDir}/wacky.js`);
    assertExists(jsModule);
    assertEquals(
      jsModule.default?.name,
      "wackyJS",
      "javascript file not loaded",
    );
  });

  await t.step("should throw if file does not exist", async () => {
    await assertRejects(
      async () => {
        return await LoadFunctionModule(`${functionsDir}/nonexistnent.ts`);
      },
      "Module not found",
    );
  });

  await t.step("should throw if function contains syntax error", async () => {
    await assertRejects(
      async () => {
        return await LoadFunctionModule(
          `${functionsDir}/syntaxerror.ts`,
        );
      },
      TypeError,
      "could not be parsed",
    );
  });

  await t.step(
    "should throw if function has a wrong import path (e.g. bad or missing import map)",
    async () => {
      const expectedMsgIncludes = parsedDenoVersion.major === 1
        ? "not prefixed"
        : "not a dependency";

      await assertRejects(
        async () => {
          return await LoadFunctionModule(
            `${functionsDir}/importerror.ts`,
          );
        },
        Error,
        expectedMsgIncludes,
      );
    },
  );

  Deno.chdir(origDir);
});
