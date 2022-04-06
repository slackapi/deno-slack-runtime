export default async function thisShouldNotCompile() {
  const _yes = "no";
  return await { outputs: { ye } };
}
