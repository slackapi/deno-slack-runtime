import { assertEquals, assertRejects, MockProtocol } from "../dev_deps.ts";
import {
  getCommandline,
  parseDevDomain,
  runWithOutgoingDomains,
} from "../local-run.ts";

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
    MockProtocol(),
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-env",
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
    MockProtocol(),
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-env",
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
    MockProtocol(),
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-env",
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
    MockProtocol(),
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-env",
    "--allow-net=slack.com,deno.land",
    FAKE_FILE_EXPECTED_MODULE,
  ]);
});

Deno.test("getCommandline handles root paths", () => {
  const command = getCommandline(
    "file:///local-run.ts",
    FAKE_DENO_PATH,
    fakeManifest("example.com"),
    "",
    MockProtocol(),
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-env",
    "--allow-net=example.com,slack.com,deno.land",
    "file:///local-run-function.ts",
  ]);
});

Deno.test("getCommandline appends protocol-specific CLI flags if they exist", () => {
  const protocol = MockProtocol();
  protocol.getCLIFlags = () => ["--mycustomflag"];
  const command = getCommandline(
    "file:///local-run.ts",
    FAKE_DENO_PATH,
    fakeManifest("example.com"),
    "",
    protocol,
  );
  assertEquals(command, [
    FAKE_DENO_PATH,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-env",
    "--allow-net=example.com,slack.com,deno.land",
    "file:///local-run-function.ts",
    "--mycustomflag",
  ]);
});

Deno.test("parseDevDomain parses the right flag", () => {
  const domain = parseDevDomain(["--sdk-slack-dev-domain=foo.com"]);
  assertEquals(domain, "foo.com");
});

Deno.test("parseDevDomain defaults to empty string", () => {
  const domain = parseDevDomain([]);
  assertEquals(domain, "");
});

Deno.test("runWithOutgoingDomains fails with no functions", () => {
  const createEmptyManifest = async () => {
    return await {};
  };
  assertRejects(() => {
    return runWithOutgoingDomains(createEmptyManifest, "", MockProtocol());
  });
});
