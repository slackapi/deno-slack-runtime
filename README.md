# deno-slack-runtime

Helper library for running a Run on Slack Deno function. The goal of this project is to provide modules for:

1. Parsing function execution event payloads into JSON (`src/parse-payload.ts`)
2. Dynamically loading the target function (`src/load-function-module.ts`)
3. Marshaling event payloads to individual functions by callback ID and running them (`src/run-function.ts`)
4. Providing a simple Slack API client (for internal use only) (`src/client.ts`)

This library has two modes of operation:

1. Using `mod.ts` as the entrypoint, a directory containing function code to be loaded at runtime must be provided as an argument. This directory must contain one source file per function, with each filename matching the function ID, i.e. if a function to be invoked is identified by the id `reverse`, the provided directory argument must contain a `reverse.ts` or a `reverse.js`.
2. Using `local-run.ts` as the entrypoint, the current working directory must contain a `manifest.json`, `manifest.ts` or `manifest.js` file, which in turn must contain function definitions that include a `source_file` property. This property is used to determine which function to load and run at runtime.

## Installation

In your project, ensure your `.slack/slack.json` file has the following section:

```
  "run": {
    "script": {
      "default": "deno run -q --unstable --import-map=import_map.json --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.4/mod.ts ./directory-where-function-code-exists"
    }
  }
```

The value of `default` may be one of the following, depending on which mode you are operating this library in:

1. Explicit function directory as argument: `deno run -q --unstable --import-map=import_map.json --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.4/mod.ts ./directory-where-function-code-exists`
2. Local project with a manifest file: `deno run -q --unstable --import-map=import_map.json --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.4/local-run.ts`

## CLI

You can also invoke this library directly from the command line, similarly to the above `slack.json` hook implementation:

    deno run -q --unstable --import-map=import_map.json --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.4/mod.ts <required-function-directory>

## Usage details

Once installed, you should be able to use the `slack` CLI to run your project locally via `slack run`.

If you would like to test this against a Slack development instance/workspace, you may need to instruct `deno` to ignore SSL certificate validation errors. You can do so by adjusting the `deno` call like so:

    deno run -q --unstable --allow-write --allow-read --allow-net --unsafely-ignore-certificate-errors=dev.slack.com https://deno.land/x/deno_slack_runtime@0.0.4/mod.ts ./functions

## Testing

Linting, formatting and test execution can be run (and a coverage report output) as follows:

    deno lint ./src
    deno fmt ./src
    deno test --allow-read --coverage=.coverage && deno coverage --exclude="fixtures|test" .coverage

# Authors

This entire code was shamelessly copied from Curtis Allen's original, internal-only Slack code. Thank you Curtis!
