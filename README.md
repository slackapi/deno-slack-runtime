# deno-slack-runtime

Helper library for running a Run on Slack Deno function. The goal of this project is to provide modules for:

1. Parsing function execution event payloads into JSON (`src/parse-payload.ts`)
2. Dynamically loading the target function (`src/load-function-module.ts`)
3. Marshaling event payloads to individual functions by callback ID and running them (`src/run-function.ts`)
4. Providing a simple Slack API client to functions being executed (`src/client.ts`)

## Installation

In your project, ensure your `.slack/slack.json` file has the following section:

TODO: once we figure out distribution for this repo, the below needs to be updated.

```
  "run": {
    "script": {
      "default": "deno run -q --unstable --allow-write --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.1/mod.ts"
    }
  }
```

This library assumes that function code exists in a `./functions/` relative to the root of your Run-on-Slack project.

## CLI

You can also invoke this library directly from the command line, similarly to the above `slack.json` hook implementation:

    deno run -q --unstable --allow-write --allow-read --allow-net https://deno.land/x/deno_slack_runtime@0.0.1/mod.ts [optional-project-root]

The `mod.ts` entry point for this library accepts an optional absolute or relative path argument pointing to the project root.
If no such path argument is provided, the current working directory is assumed to be the project root.

## Usage details

Once installed, you should be able to use the `slack` CLI to run your project locally via `slack run`.

## Testing

Linting, formatting and test execution can be run (and a coverage report output) as follows:

    deno lint ./src
    deno fmt ./src
    deno test --allow-read --coverage=.coverage && deno coverage --exclude="fixtures|test" .coverage

# Authors

This entire code was shamelessly copied from Curtis Allen's original, internal-only Slack code. Thank you Curtis!
