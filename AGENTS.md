# AGENTS.md - deno-slack-runtime

## Quick Reference

| Task                               | Command                   |
| ---------------------------------- | ------------------------- |
| Run all checks (fmt + lint + test) | `deno task test`          |
| Test only                          | `deno test --allow-read`  |
| Format check                       | `deno fmt --check`        |
| Lint                               | `deno lint`               |
| Coverage report                    | `deno task test:coverage` |
| Generate lcov                      | `deno task generate-lcov` |

## Project Overview

deno-slack-runtime is the **execution engine** for Deno Slack SDK applications.
It receives structured event payloads from Slack, dynamically loads the
appropriate user-defined function module by `callback_id`, dispatches the event
to the correct handler, and returns the response.

This is **not** the developer-facing SDK (that is
[deno-slack-sdk](https://github.com/slackapi/deno-slack-sdk)). This project is
the internal runtime layer that actually runs user code. It is published to
`deno.land/x/deno_slack_runtime`.

Three core responsibilities:

1. Parsing function execution event payloads into JSON (`src/parse-payload.ts`)
2. Dynamically loading the target function (`src/load-function-module.ts`)
3. Dispatching event payloads to functions by callback ID and running them
   (`src/dispatch-payload.ts`)

## Execution Modes

### Remote (ROSI) - `src/mod.ts`

Used on Slack's hosted infrastructure (Run on Slack Infrastructure).

- HTTP server on port 8080 (configurable with `-p` flag)
- Routes: `GET /health` (200 OK), `POST /functions` (executes user code)
- Expects pre-bundled `.js` files in a `functions/` directory, each named by
  `callback_id` (e.g., `functions/reverse.js`)
- Uses a dummy `ROSIProtocol` object wrapping console.log/warn/error
- Bundling is handled by deno-slack-hooks, not this project

### Local Dev - `src/local-run.ts` + `src/local-run-function.ts`

Used during `slack run` for local development.

- `local-run.ts` reads the app manifest (`manifest.json`, `.ts`, or `.js`) to
  find function definitions and their `source_file` paths
- Spawns a subprocess (`local-run-function.ts`) with sandboxed Deno permissions
  derived from `manifest.outgoing_domains`
- The subprocess reads event payloads from stdin, dispatches them, and responds
  via the Protocol interface
- Supports dev domain flags and SSL certificate bypass for Slack dev instances

## Architecture

### Data Flow

```text
Event Payload
  → parse-payload.ts (stdin → JSON, local mode only)
  → dispatch-payload.ts (extract event type + callback_id, load module, route)
  → run-*.ts handler (invoke user code, return response)
  → Response
```

### Core Components

| File                          | Responsibility                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/dispatch-payload.ts`     | Central router. Extracts event type and callback_id, loads the module, dispatches to correct handler |
| `src/load-function-module.ts` | Dynamic `import()` of user function modules. Accepts a file path string or module object             |
| `src/parse-payload.ts`        | Reads stdin and JSON-parses into `InvocationPayload`                                                 |
| `src/types.ts`                | All TypeScript type definitions                                                                      |
| `src/deps.ts`                 | External dependency re-exports (pinned URLs)                                                         |
| `src/dev_deps.ts`             | Test/dev dependency re-exports                                                                       |

### Event Handlers

Each handler maps to an event type and looks for a specific export on the user's
function module:

| Event Type          | Handler File                  | Expected Export   |
| ------------------- | ----------------------------- | ----------------- |
| `function_executed` | `src/run-function.ts`         | `default`         |
| `block_actions`     | `src/run-block-actions.ts`    | `blockActions`    |
| `block_suggestion`  | `src/run-block-suggestion.ts` | `blockSuggestion` |
| `view_submission`   | `src/run-view-submission.ts`  | `viewSubmission`  |
| `view_closed`       | `src/run-view-closed.ts`      | `viewClosed`      |
| unrecognized type   | `src/run-unhandled-event.ts`  | `unhandledEvent`  |

### Handler Resolution Order

Handlers check two locations in order:

1. `functionModule.<handlerName>` (top-level named export)
2. `functionModule.default.<handlerName>` (property on default export)

If neither exists, throws `UnhandledEventError`. If an `unhandledEvent` handler
exists on the module, the dispatcher catches that error and routes to it as a
fallback.

### FunctionModule Contract

This is the interface user-provided function modules must satisfy:

```typescript
type FunctionModule =
  | { default: MainFunctionHandler } & FunctionHandlers
  | {
    default?: MainFunctionHandler;
    unhandledEvent: UnhandledEventHandler;
  } & Omit<FunctionHandlers, "unhandledEvent">;
```

A module must export either `default` (the main function handler) or
`unhandledEvent` (or both).

### BaseHandlerArgs

Every handler receives these arguments:

```typescript
{
  body: ValidInvocationPayloadBody; // Full event payload body
  env: EnvironmentVariables; // From context.variables
  enterprise_id: string; // body.enterprise_id or body.enterprise.id
  inputs: FunctionInputValues; // event.inputs or function_data.inputs
  token: string; // bot_access_token (multiple fallback locations)
  team_id: string; // From context.team_id
}
```

The `extractBaseHandlerArgsFromPayload` function in `dispatch-payload.ts`
handles all fallback logic for extracting these from different payload shapes.

### RunFunction Special Behavior

Unlike other handlers, `RunFunction` (for `function_executed` events)
automatically calls Slack APIs after the user handler returns:

- `{ error: "..." }` → calls `functions.completeError`
- `{ completed: true, outputs: {...} }` (default) → calls
  `functions.completeSuccess`
- `{ completed: false }` → does nothing (function continues asynchronously)

Other handlers (`block_actions`, `view_submission`, etc.) simply return the
response from the user handler directly.

## Environment Variables

| Variable           | Effect                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| `SLACK_DEBUG=true` | Enables verbose logging of API request/response payloads in `run-function.ts` |
| `SLACK_API_URL`    | Overrides the Slack API base URL (passed to `BaseSlackAPIClient`)             |

## Code Style and Conventions

### Formatting (enforced by `deno fmt`, configured in `deno.jsonc`)

- Semicolons: required
- Quotes: double quotes
- Indent: 2 spaces
- Line width: 80 characters
- Prose wrap: always
- Tabs: never

### Patterns

- All source lives in `src/`
- One handler per file, named `run-<event-type>.ts`
- Handlers are exported as named constants (e.g.,
  `export const RunBlockAction = async (...)`)
- Dependencies centralized in `deps.ts` (external) and `dev_deps.ts` (test)
- Tests mirror source: `src/tests/<filename>.test.ts`
- Use `deno-lint-ignore no-explicit-any` sparingly when `any` is unavoidable
- Errors from user code propagate up (not caught by handlers) — this is
  intentional
- `UnhandledEventError` is used for control flow, not to signal bugs

### Dependency Management

- External deps use pinned URLs from `deno.land/x/` and `jsr:@std/`
- Lock file is disabled (`"lock": false` in `deno.jsonc`)
- No npm dependencies
- Key ecosystem packages:
  - `deno_slack_api` — Slack API client (`BaseSlackAPIClient`)
  - `deno_slack_hooks` — manifest parsing (`getManifest`)
  - `deno_slack_protocols` — protocol interface (`getProtocolInterface`,
    `Protocol` type)

## Testing

### Structure

- Tests in `src/tests/` using `Deno.test()`
- Nested test steps via `await t.step("description", async () => {...})`
- Test fixtures in `src/tests/fixtures/functions/` (excluded from fmt/lint)
- Shared test utilities in `src/tests/test_utils.ts`

### Available Test Utilities

Payload generators in `src/tests/test_utils.ts`:

- `generateFunctionExecutedPayload(callback_id, enterprise_id?)`
- `generateBlockActionsPayload(callback_id?, enterprise_id?)`
- `generateBlockSuggestionPayload(callback_id?, enterprise_id?)`
- `generateViewSubmissionPayload(callback_id?, enterprise_id?)`
- `generateViewClosedPayload(callback_id?, enterprise_id?)`
- `FAKE_ID` — constant `"ABC123"` for test IDs

### Mocking Patterns

```typescript
// Stub fetch (use `using` for automatic cleanup)
using _stubFetch = mock.stub(
  globalThis,
  "fetch",
  (url, options) => {
    // return mock Response
  },
);

// Mock protocol
const mockProtocol = MockProtocol();

// Spy assertions
mock.assertSpyCalls(spy, expectedCount);
mock.assertSpyCall(spy, callIndex, { args: [...] });
```

Always use the `using` keyword for stub cleanup (Deno's explicit resource
management).

### Running Tests

```bash
# Full check (format + lint + test) — use before committing
deno task test

# Tests only
deno test --allow-read

# Coverage
deno task test:coverage
```

## CI/CD

- Workflow: `.github/workflows/deno-ci.yml`
- Runs on push to `main` and pull requests
- Matrix: tests against both Deno v1.x and v2.x
- Steps: format check → lint → test → coverage upload (CodeCov, v2.x only)
- Health score tracking via `slackapi/slack-health-score`
- Dependabot for dependency updates with auto-merge

## Releasing

- Semantic versioning without `v` prefix (e.g., `1.1.3` not `v1.1.3`)
- Releases created via GitHub Releases UI with auto-generated notes
- Tag creation triggers publication to `deno.land/x/deno_slack_runtime` and
  `jsr.io`
- PR labels (`semver:major`, `semver:minor`, `semver:patch`) indicate version
  bump magnitude

## Ecosystem Context

| Package                                                                  | Role                 | Relationship to This Project                                                     |
| ------------------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------- |
| [deno-slack-sdk](https://github.com/slackapi/deno-slack-sdk)             | Developer-facing SDK | Provides `DefineFunction`, `SlackFunction` that users write with                 |
| [deno-slack-api](https://github.com/slackapi/deno-slack-api)             | Low-level API client | This runtime uses `BaseSlackAPIClient` to call `functions.completeSuccess/Error` |
| [deno-slack-hooks](https://github.com/slackapi/deno-slack-hooks)         | CLI hooks + manifest | Provides `getManifest()` for local-run to find function source files             |
| [deno-slack-protocols](https://github.com/slackapi/deno-slack-protocols) | Protocol abstraction | Provides `getProtocolInterface()` and `Protocol` type for CLI communication      |
| **deno-slack-runtime**                                                   | **Execution engine** | **This project** — loads and runs user functions                                 |

The Slack CLI invokes this runtime via the `start` hook defined in the app's
`slack.json`. During local development, the hook points to `local-run.ts`. On
deployed infrastructure, Slack invokes `mod.ts` directly.

## Common Tasks

### Adding a New Event Type

1. Add the event type constant to `EventTypes` in `src/types.ts`
2. Create the invocation body type (extend `BaseEventInvocationBody`) in
   `src/types.ts`
3. Create handler args type in `src/types.ts`
4. Create handler function type in `src/types.ts`
5. Add the handler property to `FunctionHandlers` type in `src/types.ts`
6. Add to `ValidInvocationPayloadBody` union in `src/types.ts`
7. Create `src/run-<event>.ts` following the pattern of existing handlers
8. Add entry to `EVENT_TO_HANDLER_MAP` in `src/dispatch-payload.ts`
9. Add payload generator to `src/tests/test_utils.ts`
10. Add test file `src/tests/run-<event>.test.ts`
11. Update `FunctionModule` type if the new handler should be optional on
    modules

### Modifying Payload Extraction

The `extractBaseHandlerArgsFromPayload` function in `dispatch-payload.ts` (line
130+) handles all fallback logic for extracting `token`, `inputs`,
`enterprise_id`, etc. from different payload shapes. Changes here affect all
handlers.

The `getFunctionCallbackID` function (line 111+) determines where to find the
`callback_id` based on event type. `function_executed` uses
`body.event.function.callback_id`; all others use
`body.function_data.function.callback_id`.

### Debugging

Set `SLACK_DEBUG=true` in environment variables to see detailed API call
logging. This currently only applies to `run-function.ts` (the
`function_executed` handler).

For local development issues, check that the manifest's `outgoing_domains`
includes all domains the function needs to reach — the runtime surfaces
`PermissionDenied` errors with a helpful message about this.
