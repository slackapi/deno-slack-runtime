import {
  createManifest,
  getProtocolInterface,
  parse,
  Protocol,
} from "./deps.ts";

const SLACK_DEV_DOMAIN_FLAG = "sdk-slack-dev-domain";

/**
 * @param args An array of command line flags
 * @returns The value of the SLACK_DEV_DOMAIN_FLAG flag, or empty string
 */
export const parseDevDomain = (args: string[]): string => {
  const flags = parse(args);
  return flags[SLACK_DEV_DOMAIN_FLAG] ?? "";
};

/**
 * Returns a module URL string pointing to `file` in the same
 * directory as `mainModule`.
 * @param mainModule The currently running Deno module, like from `Deno.mainModule`
 * @param filename The name of the file to return the URL for
 * @returns
 */
const findRelativeFile = (mainModule: string, filename: string): string => {
  const moduleUrl = new URL(mainModule);
  const path = moduleUrl.pathname;
  const pathComponents = path.split("/");
  if (pathComponents.length > 0) {
    pathComponents[pathComponents.length - 1] = filename;
  } else {
    pathComponents[0] = filename;
  }
  moduleUrl.pathname = pathComponents.join("/");
  return moduleUrl.href;
};

/**
 * Determines the command line for the `deno run` invocation that will actually run the function,
 * setting the appropriate permissions flags
 * @param mainModule The URL to the main file being run, from `Deno.mainModule`
 * @param denoExecutablePath The path to the deno executable
 * @param manifest The application's manifest
 * @param devDomain The domain of the slack dev instance being used, or empty string for production
 * @returns The commandline to run `local-run-function.ts` to actually execute the function
 */
export const getCommandline = function (
  mainModule: string,
  denoExecutablePath: string,
  // deno-lint-ignore no-explicit-any
  manifest: any,
  devDomain: string,
  walkieTalkie: Protocol,
): string[] {
  const command = [
    denoExecutablePath,
    "run",
    "-q",
    "--config=deno.jsonc",
    "--allow-read",
    "--allow-env",
  ];

  const allowedDomains = manifest.outgoing_domains ?? [];

  // If using a dev instance, allow making API calls to that domain
  // and ignore SSL errors to it
  if (devDomain !== "") {
    command.push("--unsafely-ignore-certificate-errors=" + devDomain);
    allowedDomains.push(devDomain);
  } else {
    allowedDomains.push("slack.com");
  }
  // Add deno.land to allow uncached remote deps
  allowedDomains.push("deno.land");

  command.push("--allow-net=" + allowedDomains.join(","));
  command.push(findRelativeFile(mainModule, "local-run-function.ts"));
  // If there are protocol-specific flags that need to be passed down to the child process,
  // add them here.
  if (walkieTalkie.getCLIFlags) {
    const flags = walkieTalkie.getCLIFlags();
    walkieTalkie.log("got flags", flags[0], flags[1].split("-").join(".")); // mess with the flags here so we dont trigger message boundary parsing in CLI :sweat-smile:
    command.push(...flags);
  }

  return command;
};

/**
 * @description Runs an application locally by calling `deno run` with appropriate flags.
 */
export const runWithOutgoingDomains = async function (
  create: typeof createManifest,
  devDomain: string,
  walkieTalkie: Protocol,
): Promise<void> {
  const workingDirectory = Deno.cwd();
  const manifest = await create({
    manifestOnly: true,
    log: walkieTalkie.log,
    workingDirectory,
  });

  if (!manifest.functions) {
    throw new Error(
      `No function definitions were found in the manifest! manifest.functions: ${manifest.functions}`,
    );
  }

  let denoExecutablePath = "deno";
  try {
    denoExecutablePath = Deno.execPath();
  } catch (e) {
    walkieTalkie.error("Error determining deno executable path: ", e);
    // TODO: should we throw here?
  }

  const command = getCommandline(
    Deno.mainModule,
    denoExecutablePath,
    manifest,
    devDomain,
    walkieTalkie,
  );

  // Careful uncommenting the below: since the message boundary flag will be present in there, it will mess up the CLI-side parsing!
  //walkieTalkie.log("running command: ", ...command);

  const p = Deno.run({ cmd: command });

  const status = await p.status();
  if (!status.success) {
    Deno.exit(status.code);
  }
};

if (import.meta.main) {
  const walkieTalkie = getProtocolInterface(Deno.args);
  await runWithOutgoingDomains(
    createManifest,
    parseDevDomain(Deno.args),
    walkieTalkie,
  );
}
