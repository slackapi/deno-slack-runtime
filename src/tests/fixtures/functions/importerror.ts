import * as _poo from "no-one-knows-what-this-is-really/mod.ts";

export default async function thisWillFailAtRuntime() {
  _poo.default();
  return await { outputs: { explosions: true } };
}
