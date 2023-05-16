import {
  assertEquals,
  assertExists,
  assertMatch,
  assertRejects,
  mock,
  mockFetch,
  MockProtocol,
  Spy,
} from "../dev_deps.ts";
import {
  DispatchPayload,
  extractBaseHandlerArgsFromPayload,
} from "../dispatch-payload.ts";
import { BaseEventInvocationBody, InvocationPayload } from "../types.ts";
import {
  generateBaseEventInvocationBody,
  generateBlockActionsPayload,
  generateBlockSuggestionPayload,
  generateFunctionExecutedPayload,
  generateViewClosedPayload,
  generateViewSubmissionPayload,
} from "./test_utils.ts";

const noop = () => "";

Deno.test("DispatchPayload function", async (t) => {
  await t.step("should be defined", () => {
    assertExists(DispatchPayload);
  });
  await t.step(
    "should throw if an unrecognized event type is dispatched that has a function callback_id",
    async () => {
      await assertRejects(() =>
        DispatchPayload(
          {
            body: {
              type: "messinwitcha",
              function_data: { function: { callback_id: "test" } },
            },
            context: {
              bot_access_token: "12345",
              team_id: "123",
              variables: {},
            },
          },
          MockProtocol(),
          noop,
        )
      );
    },
  );
  await t.step(
    "should warn if no function callback_id present in payload and return an empty response to ack the event",
    async () => {
      const protocol = MockProtocol();

      const result = await DispatchPayload(
        {
          body: { type: "function_executed", event: {} },
          context: { bot_access_token: "12345", team_id: "123", variables: {} },
        },
        protocol,
        noop,
      );

      const warnSpy = protocol.warn as unknown as Spy;
      mock.assertSpyCalls(warnSpy, 1);
      const warnMsg = warnSpy.calls[0].args[0] as string;
      assertMatch(warnMsg, /function_executed/);
      assertEquals(result, {});
    },
  );
  await t.step(
    "should warn if no function callback_id present in payload and type is inside event",
    async () => {
      const protocol = MockProtocol();

      const result = await DispatchPayload(
        {
          body: { event: { type: "some_random_type" } },
          context: { bot_access_token: "12345", team_id: "123", variables: {} },
        },
        protocol,
        noop,
      );

      const warnSpy = protocol.warn as unknown as Spy;
      mock.assertSpyCalls(warnSpy, 1);
      const warnMsg = warnSpy.calls[0].args[0] as string;
      assertMatch(warnMsg, /some_random_type/);
      assertEquals(result, {});
    },
  );
  await t.step(
    "should warn if no function callback_id present in payload and no type present and return an empty response to ack the event",
    async () => {
      const protocol = MockProtocol();

      const result = await DispatchPayload(
        {
          body: {},
          context: { bot_access_token: "12345", team_id: "123", variables: {} },
        },
        protocol,
        noop,
      );

      const warnSpy = protocol.warn as unknown as Spy;
      mock.assertSpyCalls(warnSpy, 1);
      const warnMsg = warnSpy.calls[0].args[0] as string;
      assertMatch(warnMsg, /unknown/);
      assertEquals(result, {});
    },
  );
});

Deno.test("DispatchPayload function file compatibility tests", async (t) => {
  const origDir = Deno.cwd();
  const __dirname = new URL(".", import.meta.url).pathname;
  const fixturesDir = `${__dirname}/fixtures`;
  Deno.chdir(fixturesDir);
  const functionsDir = `${fixturesDir}/functions`;
  mockFetch.install(); // mock out calls to fetch

  await t.step(
    "return from provided file",
    async () => {
      mockFetch.mock(
        "POST@/api/functions.completeSuccess",
        (_: Request) => {
          return new Response('{"ok":true}');
        },
      );
      const payload = generateFunctionExecutedPayload(`${functionsDir}/wacky`);
      const fnModule = await DispatchPayload(
        payload,
        MockProtocol(),
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
      const payload = generateFunctionExecutedPayload(`${functionsDir}/funky`);
      await assertRejects(
        async () => {
          return await DispatchPayload(
            payload,
            MockProtocol(),
            (functionCallbackId) => {
              return `${functionCallbackId}.js`;
            },
          );
        },
        Error,
        "Module not found",
      );
    },
  );
  Deno.chdir(origDir);
  mockFetch.uninstall();
});

Deno.test("DispatchPayload with unhandled events", async (t) => {
  mockFetch.install();

  await t.step("calls unhandledEvent with no default handler", async () => {
    const payload = generateFunctionExecutedPayload("my_func");

    const fnModule = {
      unhandledEvent: () => ({}),
    };

    const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

    await DispatchPayload(payload, MockProtocol(), () => fnModule);

    mock.assertSpyCall(unhandledEventSpy, 0, {
      args: [{
        body: payload.body,
        env: payload.context.variables,
        team_id: payload.context.team_id,
        enterprise_id: "",
        inputs: payload.body.event.inputs,
        token: payload.body.event.bot_access_token,
      }],
    });
  });

  await t.step(
    "does not call unhandledEvent with default handler",
    async () => {
      mockFetch.mock(
        "POST@/api/functions.completeSuccess",
        (_: Request) => {
          return new Response('{"ok":true}');
        },
      );
      const payload = generateFunctionExecutedPayload("my_func");

      const fnModule = {
        default: () => ({}),
        unhandledEvent: () => ({}),
      };

      const defaultSpy = mock.spy(fnModule, "default");
      const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

      await DispatchPayload(payload, MockProtocol(), () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(defaultSpy, 0, {
        args: [{
          body: payload.body,
          event: payload.body.event,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          enterprise_id: "",
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

    await DispatchPayload(payload, MockProtocol(), () => fnModule);

    mock.assertSpyCall(unhandledEventSpy, 0, {
      args: [{
        body: payload.body,
        env: payload.context.variables,
        team_id: payload.context.team_id,
        enterprise_id: "",
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

      await DispatchPayload(payload, MockProtocol(), () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(blockActionsSpy, 0, {
        args: [{
          body: payload.body,
          action: payload.body.actions[0],
          env: payload.context.variables,
          team_id: payload.context.team_id,
          enterprise_id: "",
          inputs: payload.body.function_data?.inputs,
          token: payload.body.bot_access_token,
        }],
      });
    },
  );

  await t.step(
    "calls unhandledEvent with no blockSuggestion handler",
    async () => {
      const payload = generateBlockSuggestionPayload();

      const fnModule = {
        default: () => ({}),
        unhandledEvent: () => ({}),
      };

      const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

      await DispatchPayload(payload, MockProtocol(), () => fnModule);

      mock.assertSpyCall(unhandledEventSpy, 0, {
        args: [{
          body: payload.body,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          inputs: payload.body.function_data?.inputs,
          token: payload.body.bot_access_token,
          enterprise_id: payload.body?.enterprise?.id ?? "",
        }],
      });
    },
  );

  await t.step(
    "does not call unhandledEvent with blockSuggestion handler",
    async () => {
      const payload = generateBlockSuggestionPayload();

      const fnModule = {
        default: () => ({}),
        blockSuggestion: () => ({}),
        unhandledEvent: () => ({}),
      };

      const blockSuggestionSpy = mock.spy(fnModule, "blockSuggestion");
      const unhandledEventSpy = mock.spy(fnModule, "unhandledEvent");

      await DispatchPayload(payload, MockProtocol(), () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(blockSuggestionSpy, 0, {
        args: [{
          body: payload.body,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          enterprise_id: payload.body.enterprise?.id ?? "",
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

    await DispatchPayload(payload, MockProtocol(), () => fnModule);

    mock.assertSpyCall(unhandledEventSpy, 0, {
      args: [{
        body: payload.body,
        env: payload.context.variables,
        team_id: payload.context.team_id,
        enterprise_id: "",
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

      await DispatchPayload(payload, MockProtocol(), () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(viewClosedSpy, 0, {
        args: [{
          body: payload.body,
          view: payload.body.view,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          enterprise_id: "",
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

      await DispatchPayload(payload, MockProtocol(), () => fnModule);

      mock.assertSpyCall(unhandledEventSpy, 0, {
        args: [{
          body: payload.body,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          enterprise_id: "",
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

      await DispatchPayload(payload, MockProtocol(), () => fnModule);

      mock.assertSpyCalls(unhandledEventSpy, 0);
      mock.assertSpyCall(viewSubmissionSpy, 0, {
        args: [{
          body: payload.body,
          view: payload.body.view,
          env: payload.context.variables,
          team_id: payload.context.team_id,
          enterprise_id: "",
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

      const protocol = MockProtocol();
      const warnSpy = protocol.warn as unknown as Spy;

      await DispatchPayload(payload, protocol, () => fnModule);

      mock.assertSpyCalls(warnSpy, 1);
    },
  );

  await t.step(
    "console.warn() for unrecognized event type",
    async () => {
      const payload = generateBaseEventInvocationBody(
        "unknown_type",
        "some_id",
      );

      const fnModule = {
        default: () => ({}),
      };

      const protocol = MockProtocol();
      const warnSpy = protocol.warn as unknown as Spy;

      await DispatchPayload(payload, protocol, () => fnModule);

      mock.assertSpyCalls(warnSpy, 1);
    },
  );

  await t.step(
    "handler errors are thrown",
    async () => {
      const payload = generateFunctionExecutedPayload("test_id");

      const fnModule = {
        default: () => {
          throw new Error("whoops");
        },
      };

      await assertRejects(() =>
        DispatchPayload(payload, MockProtocol(), () => fnModule)
      );
    },
  );

  mockFetch.uninstall();
});

Deno.test("DispatchPayload custom error handling", async (t) => {
  await t.step(
    "passes through generic error",
    async () => {
      const payload = generateFunctionExecutedPayload("test_id");

      const fnModule = {
        default: () => {
          throw new Error("boom");
        },
      };

      await assertRejects(
        () => DispatchPayload(payload, MockProtocol(), () => fnModule),
        Error,
        "boom",
      );
    },
  );

  await t.step(
    "customizes error if matches allow net",
    async () => {
      const payload = generateFunctionExecutedPayload("test_id");

      const fnModule = {
        default: () => {
          const e = new Error(
            'Requires net access to "example.com", run again with the --allow-net flag',
          );
          e.name = "PermissionDenied";
          throw e;
        },
      };

      await assertRejects(
        () => DispatchPayload(payload, MockProtocol(), () => fnModule),
        Error,
        "add the domain to your manifest's `outgoingDomains`",
      );
    },
  );
});

Deno.test("extractBaseHandlerArgsFromPayload method", async (t) => {
  await t.step(
    "should extract `env`, `team_id` and `token` properties from payload context object",
    () => {
      const payload = {
        body: {},
        context: {
          bot_access_token: "xoxo-1234",
          team_id: "T1234",
          variables: { hey: "yo" },
        },
      };
      const args = extractBaseHandlerArgsFromPayload(payload);
      assertEquals(args.env, payload.context.variables);
      assertEquals(args.team_id, payload.context.team_id);
      assertEquals(args.token, payload.context.bot_access_token);
    },
  );

  await t.step(
    "should set `env`, `team_id` and `token` properties to default values if missing from payload context object",
    () => {
      const payload = {
        body: {},
        context: {},
      };
      // @ts-ignore: ignoring type error for won't-happen-in-practice payload shape
      const args = extractBaseHandlerArgsFromPayload(payload);
      assertEquals(args.env, {});
      assertEquals(args.team_id, "");
      assertEquals(args.token, "");
    },
  );

  await t.step(
    "should set `enterprise_id` if exists on payload body object",
    () => {
      const payload = {
        body: {
          enterprise_id: "E123",
        },
        context: {
          bot_access_token: "xoxo-1234",
          team_id: "T1234",
          variables: { hey: "yo" },
        },
      };
      const args = extractBaseHandlerArgsFromPayload(payload);
      assertEquals(args.enterprise_id, payload.body.enterprise_id);
    },
  );

  await t.step(
    "should set `enterprise_id` if exists on payload body.enterprise object",
    () => {
      const payload = {
        body: {
          enterprise: {
            id: "E123",
          },
        },
        context: {
          bot_access_token: "xoxo-1234",
          team_id: "T1234",
          variables: { hey: "yo" },
        },
      };
      const args = extractBaseHandlerArgsFromPayload(payload);
      assertEquals(args.enterprise_id, payload.body.enterprise.id);
    },
  );

  await t.step(
    "should set `enterprise_id` to default value if not present on payload",
    () => {
      const payload = {
        body: {},
        context: {
          bot_access_token: "xoxo-1234",
          team_id: "T1234",
          variables: { hey: "yo" },
        },
      };
      const args = extractBaseHandlerArgsFromPayload(payload);
      assertEquals(args.enterprise_id, "");
    },
  );

  await t.step("should set `token` if exists on payload body object", () => {
    const payload = {
      body: { bot_access_token: "xoxo-4321" },
      context: {
        bot_access_token: "xoxo-1234",
        team_id: "T1234",
        variables: { hey: "yo" },
      },
    };
    const args = extractBaseHandlerArgsFromPayload(payload);
    assertEquals(args.token, payload.body.bot_access_token);
  });

  await t.step(
    "should set `token` if exists on payload body.event object",
    () => {
      const payload = {
        body: {
          event: {
            bot_access_token: "xoxo-4321",
          },
        },
        context: {
          bot_access_token: "xoxo-1234",
          team_id: "T1234",
          variables: { hey: "yo" },
        },
      };
      const args = extractBaseHandlerArgsFromPayload(payload);
      assertEquals(args.token, payload.body.event.bot_access_token);
    },
  );

  await t.step(
    "should set `inputs` if exists on payload body.event object",
    () => {
      const payload = {
        body: { event: { inputs: { hi: "ho" } } },
        context: {
          bot_access_token: "xoxo-1234",
          team_id: "T1234",
          variables: { hey: "yo" },
        },
      };
      const args = extractBaseHandlerArgsFromPayload(payload);
      assertEquals(args.inputs, payload.body.event.inputs);
    },
  );

  await t.step(
    "should set `inputs` if exists on payload body.function_data object",
    () => {
      const payload = {
        body: {
          function_data: {
            execution_id: "eid1234",
            function: { callback_id: "C1234" },
            inputs: { hi: "ho" },
          },
        },
        context: {
          bot_access_token: "xoxo-1234",
          team_id: "T1234",
          variables: { hey: "yo" },
        },
      } as InvocationPayload<BaseEventInvocationBody>;
      const args = extractBaseHandlerArgsFromPayload(payload);
      assertEquals(args.inputs, payload.body.function_data?.inputs);
    },
  );
});
