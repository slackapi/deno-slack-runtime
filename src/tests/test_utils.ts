import { FunctionInvocationBody, InvocationPayload } from "../types.ts";

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
        inputs: {},
      },
    },
    context: { bot_access_token: FAKE_ID, variables: {} },
  };
};
