import { InvocationPayload } from "./types.ts";

// Inject the readAll method dependency for easier testing
export const ParsePayload = async (
  // deno-lint-ignore no-explicit-any
  readAll: (input: any) => Promise<ArrayBuffer>,
): Promise<
  // deno-lint-ignore no-explicit-any
  InvocationPayload<any>
> => {
  const stdinContent = await readAll(Deno.stdin);
  const stdin = new TextDecoder().decode(stdinContent);

  try {
    // deno-lint-ignore no-explicit-any
    const payload: InvocationPayload<any> = JSON.parse(stdin);

    console.log("fn payload", JSON.stringify(payload, null, 2));
    return payload;
  } catch (e) {
    throw new Error("Error parsing function invocation payload", e);
  }
};
