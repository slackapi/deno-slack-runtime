import {
  assertEquals,
  assertRejects,
  mock,
  MockProtocol,
  Spy,
} from "../dev_deps.ts";
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

const FAKE_DENO_LAND_MODULE =
  "https://deno.land/x/deno_slack_runtime@0.3.0/local-run.ts";
const FAKE_DENO_LAND_EXPECTED_MODULE =
  "https://deno.land/x/deno_slack_runtime@0.3.0/local-run-function.ts";
const FAKE_FILE_MODULE = "file://tmp/src/local-run.ts";
const FAKE_FILE_EXPECTED_MODULE = "file://tmp/src/local-run-function.ts";

Deno.test("getCommandline function", async (t) => {
  await t.step("issues right command no dev domain", () => {
    const command = getCommandline(
      FAKE_DENO_LAND_MODULE,
      fakeManifest("example.com"),
      "",
      MockProtocol(),
    );
    assertEquals(command, [
      "run",
      "-q",
      "--config=deno.jsonc",
      "--allow-read",
      "--allow-env",
      "--allow-net=example.com,slack.com,api.slack.com,files.slack.com,deno.land",
      FAKE_DENO_LAND_EXPECTED_MODULE,
    ]);
  });

  await t.step("issues right command with dev domain", () => {
    const command = getCommandline(
      FAKE_DENO_LAND_MODULE,
      fakeManifest("example.com"),
      "dev1234.slack.com",
      MockProtocol(),
    );
    assertEquals(command, [
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

  await t.step("issues right command with no outgoing domains", () => {
    const command = getCommandline(
      FAKE_DENO_LAND_MODULE,
      fakeManifest(),
      "",
      MockProtocol(),
    );
    assertEquals(command, [
      "run",
      "-q",
      "--config=deno.jsonc",
      "--allow-read",
      "--allow-env",
      "--allow-net=slack.com,api.slack.com,files.slack.com,deno.land",
      FAKE_DENO_LAND_EXPECTED_MODULE,
    ]);
  });

  await t.step("issues right command with a local file module", () => {
    const command = getCommandline(
      FAKE_FILE_MODULE,
      fakeManifest(),
      "",
      MockProtocol(),
    );
    assertEquals(command, [
      "run",
      "-q",
      "--config=deno.jsonc",
      "--allow-read",
      "--allow-env",
      "--allow-net=slack.com,api.slack.com,files.slack.com,deno.land",
      FAKE_FILE_EXPECTED_MODULE,
    ]);
  });

  await t.step("handles root paths", () => {
    const command = getCommandline(
      "file:///local-run.ts",
      fakeManifest("example.com"),
      "",
      MockProtocol(),
    );
    assertEquals(command, [
      "run",
      "-q",
      "--config=deno.jsonc",
      "--allow-read",
      "--allow-env",
      "--allow-net=example.com,slack.com,api.slack.com,files.slack.com,deno.land",
      "file:///local-run-function.ts",
    ]);
  });

  await t.step("appends protocol-specific CLI flags if they exist", () => {
    const protocol = MockProtocol();
    protocol.getCLIFlags = () => ["--mycustomflag"];
    const command = getCommandline(
      "file:///local-run.ts",
      fakeManifest("example.com"),
      "",
      protocol,
    );
    assertEquals(command, [
      "run",
      "-q",
      "--config=deno.jsonc",
      "--allow-read",
      "--allow-env",
      "--allow-net=example.com,slack.com,api.slack.com,files.slack.com,deno.land",
      "file:///local-run-function.ts",
      "--mycustomflag",
    ]);
  });
});

Deno.test("parseDevDomain function", async (t) => {
  await t.step("parses the right flag", () => {
    const domain = parseDevDomain(["--sdk-slack-dev-domain=foo.com"]);
    assertEquals(domain, "foo.com");
  });

  Deno.test("parseDevDomain defaults to empty string", () => {
    const domain = parseDevDomain([]);
    assertEquals(domain, "");
  });
});

Deno.test("runWithOutgoingDomains function", async (t) => {
  await t.step("fails with no functions", () => {
    const createEmptyManifest = async () => {
      return await {};
    };
    assertRejects(() => {
      return runWithOutgoingDomains(createEmptyManifest, "", MockProtocol());
    });
  });

  await t.step(
    "reports an error if the deno execPath cannot be found",
    async () => {
      const createEmptyManifest = () => {
        return Promise.resolve({
          functions: {},
        });
      };
      const protocol = MockProtocol();
      const errorSpy = protocol.error as unknown as Spy;
      const execPathSpy = mock.stub(Deno, "execPath", () => {
        throw new Error("no idea where that is");
      });
      const commandStub = mock.stub(
        Deno,
        "Command",
        () => ({
          spawn: () => {
            return {
              status: Promise.resolve({ success: true, code: 0 }),
            } as unknown as Deno.ChildProcess;
          },
        } as Deno.Command),
      );
      try {
        await runWithOutgoingDomains(createEmptyManifest, "", protocol);
      } finally {
        execPathSpy.restore();
        commandStub.restore();
      }
      mock.assertSpyCallArg(
        errorSpy,
        0,
        0,
        "Error determining deno executable path: ",
      );
    },
  );

  await t.step(
    "exits the Deno process if the local run process exits with a non-zero status code",
    async () => {
      const createEmptyManifest = () => {
        return Promise.resolve({
          functions: {},
        });
      };
      const protocol = MockProtocol();
      const exitSpy = mock.spy();
      const exitStub = mock.stub(
        Deno,
        "exit",
        exitSpy as unknown as () => never,
      );
      const exitCode = 1337;
      const commandStub = mock.stub(
        Deno,
        "Command",
        () => ({
          spawn: () => {
            return {
              status: Promise.resolve({ success: false, code: exitCode }),
            } as unknown as Deno.ChildProcess;
          },
        } as Deno.Command),
      );
      try {
        await runWithOutgoingDomains(createEmptyManifest, "", protocol);
      } finally {
        commandStub.restore();
        exitStub.restore();
      }
      mock.assertSpyCallArg(
        exitSpy,
        0,
        0,
        exitCode,
      );
    },
  );
});
