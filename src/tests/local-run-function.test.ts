import {
  assertExists,
  assertRejects,
  mock,
  MockProtocol,
  Spy,
} from "../dev_deps.ts";
import { runLocally } from "../local-run-function.ts";
import { BaseEventInvocationBody, InvocationPayload } from "../types.ts";

const ID = "1234";
// deno-lint-ignore no-explicit-any
const fakeManifest = async (_: any): Promise<any> => {
  return await {
    functions: {
      [ID]: {
        source_file: "some/file.ts",
      },
    },
  };
};
const noop = () => Promise.resolve(null);
// deno-lint-ignore no-explicit-any
const fakeParse = async (_: any): Promise<InvocationPayload<any>> => {
  return await {} as InvocationPayload<BaseEventInvocationBody>;
};
const fakeStdinReader = (
  // deno-lint-ignore no-explicit-any
  _: any,
): Promise<Uint8Array> => Promise.resolve(new Uint8Array(0));

Deno.test("runLocally function sad path", async (t) => {
  await t.step("should be defined", () => {
    assertExists(runLocally);
  });
  await t.step(
    "should throw if manifest does not contain a functions field",
    async () => {
      await assertRejects(
        () =>
          runLocally(
            (_) => Promise.resolve({ whatever: false }),
            fakeParse,
            fakeStdinReader,
            noop,
            MockProtocol(),
          ),
        Error,
        "No function definitions",
      );
    },
  );
  await t.step(
    "should throw if manifest does not contain a function definition that matches payload function callback ID",
    async () => {
      await assertRejects(
        () =>
          runLocally(
            (_) => (Promise.resolve({ functions: {} })),
            fakeParse,
            fakeStdinReader,
            (_payload, _protocol, getFile) => Promise.resolve(getFile(ID)),
            MockProtocol(),
          ),
        Error,
        "No function definition for function callback id",
      );
    },
  );
});

Deno.test("runLocally function happy path", async (t) => {
  await t.step(
    "should feed dispatch response as stringified JSON to protocol respond method",
    async () => {
      const protocol = MockProtocol();
      await runLocally(
        fakeManifest,
        fakeParse,
        fakeStdinReader,
        () => Promise.resolve({ something: true }),
        protocol,
      );
      mock.assertSpyCallArg(
        protocol.respond as unknown as Spy,
        0,
        0,
        `{"something":true}`,
      );
    },
  );
});
