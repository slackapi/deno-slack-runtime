import {
  EventTypes,
  FunctionModule,
  InvocationPayload,
  ViewClosedInvocationBody,
} from "./types.ts";
import { UnhandledEventError } from "./run-unhandled-event.ts";
import { Protocol } from "./deps.ts";

export const RunViewClosed = async (
  payload: InvocationPayload<ViewClosedInvocationBody>,
  functionModule: FunctionModule,
  walkieTalkie: Protocol,
  // deno-lint-ignore no-explicit-any
): Promise<any> => {
  const { body, context } = payload;
  const view = body.view;
  const env = context.variables || {};
  const team_id = context.team_id || "";
  const enterprise_id = body.enterprise?.id || "";
  const token = body.bot_access_token || context.bot_access_token || "";
  const inputs = body.function_data?.inputs || {};

  const handler = functionModule.viewClosed ||
    functionModule.default?.viewClosed;
  if (!handler) {
    throw new UnhandledEventError(
      `Received a ${EventTypes.VIEW_CLOSED} payload but the function does not define a viewClosed handler`,
    );
  }
  // In case this is a local-run, and we use a protocol that has specific rules around when we can use stdout/stderr,
  // we install any protocol-specific mocks required.
  if (walkieTalkie.install) walkieTalkie.install();
  // deno-lint-ignore no-explicit-any
  let response: any = {};
  try {
    response = await handler({
      inputs,
      env,
      token,
      team_id,
      enterprise_id,
      body,
      view,
    });
  } catch (e) {
    // In case this is a local-run, and we use a protocol that has specific rules around when we can use stdout/stderr,
    // we uninstall any protocol-specific mocks we installed earlier if userland code explodes, and re-throw the error
    if (walkieTalkie.uninstall) walkieTalkie.uninstall();
    throw e;
  }
  if (walkieTalkie.uninstall) walkieTalkie.uninstall();

  return response || {};
};
