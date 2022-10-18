import { assertEquals } from "../dev_deps.ts";
import { getCommandline } from "../local-run.ts";

const fakeManifest = (...domains: string[]) => {
  return {
    functions: ["dummy"],
    outgoing_domains: domains,
  };
};

const FAKE_DENO_PATH = "/path/to/deno";

const FAKE_DENO_LAND_MODULE =
  "https://deno.land/x/deno_slack_runtime@0.3.0/local-run.ts";
const FAKE_DENO_LAND_EXPECTED_MODULE =
  "https://deno.land/x/deno_slack_runtime@0.3.0/local-run-function.ts";
const FAKE_FILE_MODULE = "file://tmp/src/local-run.ts";
const FAKE_FILE_EXPECTED_MODULE = "file://tmp/src/local-run-function.ts";

Deno.test("getCommandline issues right command no dev domain", () => {
  const command = getCommandline(
    FAKE_DENO_LAND_MODULE,
    FAKE_DENO_PATH,
    fakeManifest("example.com"),
    "",
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-net=example.com,slack.com,deno.land",
    FAKE_DENO_LAND_EXPECTED_MODULE,
  ]);
});

Deno.test("getCommandline issues right command with dev domain", () => {
  const command = getCommandline(
    FAKE_DENO_LAND_MODULE,
    FAKE_DENO_PATH,
    fakeManifest("example.com"),
    "dev1234.slack.com",
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--unsafely-ignore-certificate-errors=dev1234.slack.com",
    "--allow-net=example.com,dev1234.slack.com,deno.land",
    FAKE_DENO_LAND_EXPECTED_MODULE,
  ]);
});

Deno.test("getCommandline issues right command with no outgoing domains", () => {
  const command = getCommandline(
    FAKE_DENO_LAND_MODULE,
    FAKE_DENO_PATH,
    fakeManifest(),
    "",
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-net=slack.com,deno.land",
    FAKE_DENO_LAND_EXPECTED_MODULE,
  ]);
});

Deno.test("getCommandline issues right command with a local file module", () => {
  const command = getCommandline(
    FAKE_FILE_MODULE,
    FAKE_DENO_PATH,
    fakeManifest(),
    "",
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-net=slack.com,deno.land",
    FAKE_FILE_EXPECTED_MODULE,
  ]);
});
