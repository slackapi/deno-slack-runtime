import { assertEquals, assertExists, assertRejects } from "../dev_deps.ts";
import { LoadFunctionModule } from "../load-function-module.ts";

Deno.test("LoadFunctionModule function", async (t) => {
  const origDir = Deno.cwd();
  const __dirname = new URL(".", import.meta.url).pathname;
  const fixturesDir = `${__dirname}/fixtures`;
  Deno.chdir(fixturesDir);
  const functionsDir = `${fixturesDir}/functions`;

  await t.step(
    "should return null if no files are provided",
    async () => {
      const fnModule = await LoadFunctionModule([]);
      assertEquals(fnModule, null);
    },
  );

  await t.step("should load the correct file when given multiple", async () => {
    const tsModule = await LoadFunctionModule(
      [
        `${functionsDir}/funky.js`,
        `${functionsDir}/funky.ts`,
      ],
    );
    assertExists(tsModule);
    assertEquals(
      tsModule.default?.name,
      "funkyTS",
      "typescript file not loaded",
    );
  });

  await t.step("should load the js file if ts file is invalid", async () => {
    const jsModule = await LoadFunctionModule(
      [
        `${functionsDir}/badFile.ts`,
        `${functionsDir}/wacky.js`,
      ],
    );
    assertExists(jsModule);
    assertEquals(
      jsModule.default?.name,
      "wackyJS",
      "javascript file not loaded over invalid typescript file",
    );
  });

  await t.step("should load typescript file if exists", async () => {
    const tsModule = await LoadFunctionModule(
      [`${functionsDir}/funky.ts`],
    );
    assertExists(tsModule);
    assertEquals(
      tsModule.default?.name,
      "funkyTS",
      "typescript file not loaded",
    );
  });

  await t.step("should load javascript file if exists", async () => {
    const jsModule = await LoadFunctionModule(
      [`${functionsDir}/wacky.js`],
    );
    assertExists(jsModule);
    assertEquals(
      jsModule.default?.name,
      "wackyJS",
      "javascript file not loaded",
    );
  });

  await t.step("should throw if does not exist", async () => {
    const jsModule = await LoadFunctionModule(
      [`${functionsDir}/nonexistnent.ts`],
    );
    assertEquals(
      jsModule,
      null,
      "Could not load function module for function: nonexistent",
    );
  });

  await t.step("should throw if function contains syntax error", async () => {
    await assertRejects(
      async () => {
        return await LoadFunctionModule(
          [`${functionsDir}/syntaxerror.ts`],
        );
      },
      TypeError,
      "[ERROR]",
    );
  });

  await t.step(
    "should throw if function has a wrong import path (e.g. bad or missing import map)",
    async () => {
      await assertRejects(
        async () => {
          return await LoadFunctionModule(
            [`${functionsDir}/importerror.ts`],
          );
        },
        Error,
        "not prefixed",
      );
    },
  );

  Deno.chdir(origDir);
});
