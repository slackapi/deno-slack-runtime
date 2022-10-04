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
export const generatePayload = (
  id: string,
): InvocationPayload<FunctionInvocationBody> => {
  return {
    body: {
      event: {
        type: "function_executed",
        function: { callback_id: id },
        function_execution_id: FAKE_ID,
        bot_access_token: FAKE_ID,
        inputs: {},
      },
      enterprise_id: FAKE_ID,
    },
    context: { bot_access_token: FAKE_ID, team_id: FAKE_ID, variables: {} },
  };
};

export const generateBaseInvocationBody = (
  type: string,
  id?: string,
): InvocationPayload<BaseEventInvocationBody> => {
  return {
    body: {
      type,
      function_data: {
        execution_id: FAKE_ID,
        function: { callback_id: id || FAKE_ID },
        inputs: {},
      },
      bot_access_token: FAKE_ID,
    },
    context: { team_id: FAKE_ID, bot_access_token: FAKE_ID, variables: {} },
  };
};

export const generateBlockActionsPayload = (
  id?: string,
): InvocationPayload<BlockActionInvocationBody> => {
  return {
    body: {
      type: "block_actions",
      actions: [],
      function_data: {
        execution_id: FAKE_ID,
        function: { callback_id: id || FAKE_ID },
        inputs: {},
      },
      enterprise: { id: FAKE_ID },
      bot_access_token: FAKE_ID,
    },
    context: { bot_access_token: FAKE_ID, team_id: FAKE_ID, variables: {} },
  };
};

export const generateBlockSuggestionPayload = (
  id?: string,
): InvocationPayload<BlockSuggestionInvocationBody> => {
  return {
    body: {
      type: "block_suggestion",
      function_data: {
        execution_id: FAKE_ID,
        function: { callback_id: id || FAKE_ID },
        inputs: {},
      },
      action_id: "test",
      block_id: "test_block",
      value: "test-query",
      bot_access_token: FAKE_ID,
    },
    context: { bot_access_token: FAKE_ID, team_id: FAKE_ID, variables: {} },
  };
};

export const generateViewSubmissionPayload = (
  id?: string,
): InvocationPayload<ViewSubmissionInvocationBody> => {
  return {
    body: {
      type: "view_submission",
      view: {},
      function_data: {
        execution_id: FAKE_ID,
        function: { callback_id: id || FAKE_ID },
        inputs: {},
      },
      enterprise: { id: FAKE_ID },
      bot_access_token: FAKE_ID,
    },
    context: { bot_access_token: FAKE_ID, team_id: FAKE_ID, variables: {} },
  };
};

export const generateViewClosedPayload = (
  id?: string,
): InvocationPayload<ViewClosedInvocationBody> => {
  return {
    body: {
      type: "view_closed",
      view: {},
      function_data: {
        execution_id: FAKE_ID,
        function: { callback_id: id || FAKE_ID },
        inputs: {},
      },
      enterprise: { id: FAKE_ID },
      bot_access_token: FAKE_ID,
    },
    context: { bot_access_token: FAKE_ID, team_id: FAKE_ID, variables: {} },
  };
};
