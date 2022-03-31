import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std/testing/asserts.ts";
import * as mf from "https://deno.land/x/mock_fetch@0.2.0/mod.ts";
import { serializeData, SlackAPIClient } from "../client.ts";

Deno.test("Slack API client", async (t) => {
  // mock out `fetch`
  mf.install();
  const client = new SlackAPIClient("sometoken");

  await t.step("call() method", async () => {
    mf.mock("POST@/api/chat.postMessage", () => {
      return new Response('{"ok":true}');
    });

    const res = await client.call("chat.postMessage", {});
    assertEquals(res.ok, true);

    mf.reset();

    mf.mock("POST@/api/chat.postMessage", () => {
      return new Response('{"ok":false}', { status: 500 });
    });
    await assertRejects(async () => {
      return await client.call("chat.postMessage", {});
    });

    mf.reset();
  });
  mf.uninstall();
});

Deno.test("serializeData API client helper method", () => {
  assertEquals(
    serializeData({ string: "yes", number: 1, boolean: true }).toString(),
    "string=yes&number=1&boolean=true",
    "Failed to serialize primitive object values",
  );
  assertEquals(
    serializeData({ complex: { object: "indeed" } }).toString(),
    "complex=%7B%22object%22%3A%22indeed%22%7D",
    "Failed to serialize primitive object values",
  );
});
