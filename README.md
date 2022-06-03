# deno-slack-runtime

Helper library for running a Run on Slack Deno function. The goal of this project is to provide modules for:

1. Parsing function execution event payloads into JSON (`src/parse-payload.ts`)
2. Dynamically loading the target function (`src/load-function-module.ts`)
3. Marshaling event payloads to individual functions by callback ID and running them (`src/run-function.ts`)

This library has two modes of operation:

1. Using `mod.ts` as the entrypoint, a directory containing function code files to be loaded at runtime must be provided as an argument. This directory must contain one source file per function, with each filename matching the function ID, i.e. if a function to be invoked has a `callback_id` of `reverse`, the provided directory argument must contain a `reverse.ts` or a `reverse.js`.
2. Using `local-run.ts` as the entrypoint, the current working directory must contain a `manifest.json`, `manifest.ts` or `manifest.js` file, which in turn must contain function definitions that include a `source_file` property. This property is used to determine which function to load and run at runtime.

Regardless of which mode of operation used, each runtime definition for a function is specified in it's own file and must be the default export.

## Usage

By default, your Slack app has a `/slack.json` file that defines a `get-hooks` hook. The Slack CLI will automatically use the version of the `deno-slack-runtime` that is specified by the version of the `get-hooks` script that you're using. To use this library via the Slack CLI out of the box, use the `slack run` command in your terminal. This will automatically run the `start` hook and wait for events to parse the payload.

### Override

You also have the option to [override this hook](https://github.com/slackapi/deno-slack-hooks#script-overrides)! You can change the script that runs by specifying a new script for the `start` command. For instance, if you wanted to point to your local instance of this repo, you could accomplish that by adding a `start` command to your `/slack.json` file and setting it to the following:

```json
{
  "hooks": {
    /* ... */
    "start": "deno run -q --unstable --config=deno.jsonc --allow-read --allow-net file:///<path-to-your-local-repo>/local-run.ts"
  }
}
```

The script may be one of the following, depending on which mode you are operating this library in:

1. Explicit function directory as argument: `deno run -q --unstable --config=deno.jsonc --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.6/mod.ts ./<required-function-directory>`
2. Local project with a manifest file: `deno run -q --unstable --config=deno.jsonc --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.6/local-run.ts`

⚠️ Don't forget to update the version specifier in the URL inside the above commands to match the version you want to test! You can also drop the `@` and the version specifier to use the latest released version. You can also use the `file:///` protocol to point to a version present on your local filesystem.

### CLI

You can also invoke this library directly from the command line:

    deno run -q --unstable --config=deno.jsonc --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.6/mod.ts ./<required-function-directory>

## Running Tests

If you make changes to this repo, or just want to make sure things are working as desired, you can run:

    deno task test

To get a full test coverage report, run:

    deno task coverage

---

### Getting Help

We welcome contributions from everyone! Please check out our
[Contributor's Guide](.github/CONTRIBUTING.md) for how to contribute in a
helpful and collaborative way.
