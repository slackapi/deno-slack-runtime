import {
  BaseEventInvocationBody,
  BlockActionInvocationBody,
  BlockSuggestionInvocationBody,
  FunctionInvocationBody,
  InvocationPayload,
  ViewClosedInvocationBody,
  ViewSubmissionInvocationBody,
} from "../types.ts";

export const FAKE_ID = "ABC123";
export const generateFunctionExecutedPayload = (
  callback_id: string,
  enterprise_id?: string,
): InvocationPayload<FunctionInvocationBody> => {
  return {
    body: {
      event: {
        type: "function_executed",
        function: { callback_id },
        function_execution_id: FAKE_ID,
        bot_access_token: FAKE_ID,
        inputs: {},
      },
      // Setting to undefined in an effort to model how this property shows up in production: either exists, or it is not defined at all
      enterprise_id: enterprise_id ? enterprise_id : undefined,
    },
    context: { bot_access_token: FAKE_ID, team_id: FAKE_ID, variables: {} },
  };
};

export const generateBaseEventInvocationBody = (
  type: string,
  callback_id?: string,
  enterprise_id?: string,
): InvocationPayload<BaseEventInvocationBody> => {
  const payload = {
    body: {
      type,
      function_data: {
        execution_id: FAKE_ID,
        function: { callback_id: callback_id || FAKE_ID },
        inputs: {},
      },
      bot_access_token: FAKE_ID,
    },
    context: { team_id: FAKE_ID, bot_access_token: FAKE_ID, variables: {} },
  } as InvocationPayload<BaseEventInvocationBody>;
  if (enterprise_id) {
    payload.body.enterprise = { id: enterprise_id };
  }
  return payload;
};

export const generateBlockActionsPayload = (
  callback_id?: string,
  enterprise_id?: string,
): InvocationPayload<BlockActionInvocationBody> => {
  const payload = generateBaseEventInvocationBody(
    "block_actions",
    callback_id,
    enterprise_id,
  );
  payload.body.actions = [];
  return payload as InvocationPayload<BlockActionInvocationBody>;
};

export const generateBlockSuggestionPayload = (
  callback_id?: string,
  enterprise_id?: string,
): InvocationPayload<BlockSuggestionInvocationBody> => {
  const payload = generateBaseEventInvocationBody(
    "block_suggestion",
    callback_id,
    enterprise_id,
  );
  payload.body.action_id = "test";
  payload.body.block_id = "test_block";
  payload.body.value = "test-query";
  return payload as InvocationPayload<BlockSuggestionInvocationBody>;
};

export const generateViewSubmissionPayload = (
  callback_id?: string,
  enterprise_id?: string,
): InvocationPayload<ViewSubmissionInvocationBody> => {
  const payload = generateBaseEventInvocationBody(
    "view_submission",
    callback_id,
    enterprise_id,
  );
  payload.body.view = {};
  return payload as InvocationPayload<ViewSubmissionInvocationBody>;
};

export const generateViewClosedPayload = (
  callback_id?: string,
  enterprise_id?: string,
): InvocationPayload<ViewClosedInvocationBody> => {
  const payload = generateBaseEventInvocationBody(
    "view_closed",
    callback_id,
    enterprise_id,
  );
  payload.body.view = {};
  return payload as InvocationPayload<ViewClosedInvocationBody>;
};
