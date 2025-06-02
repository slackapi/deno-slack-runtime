import { InvocationPayload } from "./types.ts";
import { readAll } from "./deps.ts";

// Inject the readAll method dependency for easier testing
export const ParsePayload = async (
  readStdin: typeof readAll,
): Promise<
  // deno-lint-ignore no-explicit-any
  InvocationPayload<any>
> => {
  const stdinContent = await readStdin(Deno.stdin);
  const stdin = new TextDecoder().decode(stdinContent);

  try {
    // deno-lint-ignore no-explicit-any
    const payload: InvocationPayload<any> = JSON.parse(stdin);

    return payload;
  } catch (e) {
    if (e instanceof Error) {
      throw new Error("Error parsing function invocation payload", e);
    }
    throw new Error("Error parsing function invocation payload");
  }
};
