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
    "start": "deno run -q --unstable --config=deno.jsonc --allow-read --allow-net /<path-to-your-local-repo>/local-run.ts"
  }
}
```

The script may be one of the following, depending on which mode you are operating this library in:

1. Explicit function directory as argument: `deno run -q --unstable --config=deno.jsonc --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.6/mod.ts ./<required-function-directory>`
2. Local project with a manifest file: `deno run -q --unstable --config=deno.jsonc --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.6/local-run.ts`

### CLI

You can also invoke this library directly from the command line:

    deno run -q --unstable --config=deno.jsonc --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.6/mod.ts ./<required-function-directory>

## Testing

Linting, formatting and test execution can be run (and a coverage report output) as follows:

    deno lint ./src
    deno fmt ./src
    deno test --allow-read --coverage=.coverage && deno coverage --exclude="fixtures|test" .coverage

# Authors

This entire code was shamelessly copied from Curtis Allen's original, internal-only Slack code, which he had gotten most of from Brad Harris. Thank you Curtis and Brad!
