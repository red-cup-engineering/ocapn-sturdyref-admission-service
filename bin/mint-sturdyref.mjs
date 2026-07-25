#!/usr/bin/env node

import { chmod, writeFile } from "node:fs/promises";
import { createSturdyRefStore } from "../src/admission.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (typeof value !== "string" || value === "") throw new Error(`${name} is required`);
  return value;
}

const output = option("--output");
const grant = await createSturdyRefStore({ root: option("--root") }).mint({
  holder: option("--holder"),
  locus: option("--locus"),
});
await writeFile(output, `${grant.sturdyRef}\n`, { mode: 0o600 });
await chmod(output, 0o600);
process.stdout.write(`${JSON.stringify({ ...grant, sturdyRef: "[written-to-output]" })}\n`);
