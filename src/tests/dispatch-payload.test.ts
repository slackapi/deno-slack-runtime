import {
  assertEquals,
  assertExists,
  assertRejects,
  mock,
} from "../dev_deps.ts";
import { DispatchPayload } from "../dispatch-payload.ts";
import {
  generateBlockActionsPayload,
  generatePayload,
  generateViewClosedPayload,
  generateViewSubmissionPayload,
} from "./test_utils.ts";

const noop = () => "";

Deno.test("DispatchPayload function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(DispatchPayload);
  });
  await t.step(
    "should throw if no function callback_id present in payload",
    async () => {
      await assertRejects(
        () =>
          DispatchPayload({
            body: { type: "function_executed", event: {} },
            context: {
              bot_access_token: "12345",
              team_id: "123",
              variables: {},
            },
          }, noop),
        Error,
        "not find the function callback_id",
      );
    },
  );
});

Deno.test("DispatchPayload function file compatibility tests", async (t) => {
  const origDir = Deno.cwd();
  const __dirname = new URL(".", import.meta.url).pathname;
  const fixturesDir = `${__dirname}/fixtures`;
  Deno.chdir(fixturesDir);
  const functionsDir = `${fixturesDir}/functions`;

  await t.step(
    "return from provided file",
    async () => {
      const payload = {
        body: {
          event: {
            function: {
              callback_id: `${functionsDir}/wacky`,
            },
            type: "function_executed",
          },
        },
        context: {
          bot_access_token: "",
          team_id: "",
          variables: {},
        },
      };
      const fnModule = await DispatchPayload(
        payload,
        (functionCallbackId) => {
          return `${functionCallbackId}.js`;
        },
      );
      assertEquals(fnModule, {});
    },
  );
  await t.step(
    "file not found",
    async () => {
      const payload = {
        body: {
          event: {
            function: {
              callback_id: `${functionsDir}/funky`,
            },
            type: "function_executed",
          },
        },
        context: {
          bot_access_token: "",
          team_id: "",
          variables: {},
        },
      };
      await assertRejects(
        async () => {
          return await DispatchPayload(payload, (functionCallbackId) => {
            return `${functionCallbackId}.js`;
          });
        },
        Error,
        "Module not found",
      );
    },
  );
  Deno.chdir(origDir);
});

Deno.test("DispatchPayload with unhandled events", async (t) => {
  await t.step("calls unhandledEvent with no default handler", async () => {
    const payload = generatePayload("my_func");

    const fnModule = {
      unhandledEvent: () => ({}),
    };

    const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

    await DispatchPayload(payload, () => fnModule);

    mock.assertSpyCall(unhandledEventSpy, 0, {
      args: [{
        body: payload.body,
        env: payload.context.variables,
        team_id: payload.context.team_id,
        inputs: payload.body.event.inputs,
        token: payload.body.event.bot_access_token,
      }],
    });
  });

  await t.step(
    "does not call unhandledEvent with default handler",
    async () => {
      const payload = generatePayload("my_func");

      const fnModule = {
        default: () => ({}),
        unhandledEvent: () => ({}),
      };

      const defaultSpy = mock.spy(fnModule, "default");
      const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

      await DispatchPayload(payload, () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(defaultSpy, 0, {
        args: [{
          event: payload.body.event,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          inputs: payload.body.event.inputs,
          token: payload.body.event.bot_access_token,
        }],
      });
    },
  );

  await t.step("calls unhandledEvent with no blockAction handler", async () => {
    const payload = generateBlockActionsPayload();

    const fnModule = {
      default: () => ({}),
      unhandledEvent: () => ({}),
    };

    const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

    await DispatchPayload(payload, () => fnModule);

    mock.assertSpyCall(unhandledEventSpy, 0, {
      args: [{
        body: payload.body,
        env: payload.context.variables,
        team_id: payload.context.team_id,
        inputs: payload.body.function_data?.inputs,
        token: payload.body.bot_access_token,
      }],
    });
  });

  await t.step(
    "does not call unhandledEvent with blockAction handler",
    async () => {
      const payload = generateBlockActionsPayload();

      const fnModule = {
        default: () => ({}),
        blockActions: () => ({}),
        unhandledEvent: () => ({}),
      };

      const blockActionsSpy = mock.spy(fnModule, "blockActions");
      const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

      await DispatchPayload(payload, () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(blockActionsSpy, 0, {
        args: [{
          body: payload.body,
          action: payload.body.actions[0],
          env: payload.context.variables,
          team_id: payload.context.team_id,
          inputs: payload.body.function_data?.inputs,
          token: payload.body.bot_access_token,
        }],
      });
    },
  );

  await t.step("calls unhandledEvent with no viewClosed handler", async () => {
    const payload = generateViewClosedPayload();

    const fnModule = {
      default: () => ({}),
      unhandledEvent: () => ({}),
    };

    const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

    await DispatchPayload(payload, () => fnModule);

    mock.assertSpyCall(unhandledEventSpy, 0, {
      args: [{
        body: payload.body,
        env: payload.context.variables,
        team_id: payload.context.team_id,
        inputs: payload.body.function_data?.inputs,
        token: payload.body.bot_access_token,
      }],
    });
  });

  await t.step(
    "does not call unhandledEvent with viewClosed handler",
    async () => {
      const payload = generateViewClosedPayload();

      const fnModule = {
        default: () => ({}),
        viewClosed: () => ({}),
        unhandledEvent: () => ({}),
      };

      const viewClosedSpy = mock.spy(fnModule, "viewClosed");
      const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

      await DispatchPayload(payload, () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(viewClosedSpy, 0, {
        args: [{
          body: payload.body,
          view: payload.body.view,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          inputs: payload.body.function_data?.inputs,
          token: payload.body.bot_access_token,
        }],
      });
    },
  );

  await t.step(
    "calls unhandledEvent with no viewSubmission handler",
    async () => {
      const payload = generateViewSubmissionPayload();

      const fnModule = {
        default: () => ({}),
        unhandledEvent: () => ({}),
      };

      const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

      await DispatchPayload(payload, () => fnModule);

      mock.assertSpyCall(unhandledEventSpy, 0, {
        args: [{
          body: payload.body,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          inputs: payload.body.function_data?.inputs,
          token: payload.body.bot_access_token,
        }],
      });
    },
  );

  await t.step(
    "does not call unhandledEvent with viewSubmission handler",
    async () => {
      const payload = generateViewSubmissionPayload();

      const fnModule = {
        default: () => ({}),
        viewSubmission: () => ({}),
        unhandledEvent: () => ({}),
      };

      const viewSubmissionSpy = mock.spy(fnModule, "viewSubmission");
      const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

      await DispatchPayload(payload, () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(viewSubmissionSpy, 0, {
        args: [{
          body: payload.body,
          view: payload.body.view,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          inputs: payload.body.function_data?.inputs,
          token: payload.body.bot_access_token,
        }],
      });
    },
  );

  await t.step(
    "console.warn() if no matching handler provided and no unhandledEvent handler provided",
    async () => {
      const payload = generateBlockActionsPayload();

      const fnModule = {
        default: () => ({}),
      };

      const consoleWarnSpy = mock.spy(console, "warn");

      await DispatchPayload(payload, () => fnModule);

      mock.assertSpyCalls(consoleWarnSpy, 1);

      consoleWarnSpy.restore();
    },
  );
});
