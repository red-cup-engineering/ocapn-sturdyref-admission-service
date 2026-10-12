import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSturdyRefStore } from "../src/admission.mjs";

test("one unforgeable sturdyref admits only its exact granted locus and leaves receipts", async () => {
  const root = await mkdtemp(join(tmpdir(), "ocapn-admission-"));
  const store = createSturdyRefStore({ root, now: () => "2026-07-25T00:00:00.000Z" });
  const grant = await store.mint({ holder: "urn:customer:alpha", locus: "advance-settlement-pulse" });
  assert.match(grant.sturdyRef, /^urn:ocapn:sturdyref:[A-Za-z0-9_-]{43}$/u);
  assert.equal((await store.admit({ sturdyRef: grant.sturdyRef, locus: grant.locus })).admitted, true);
  assert.equal((await store.admit({ sturdyRef: grant.sturdyRef, locus: "other-operation" })).reason, "locus-not-granted");
  assert.equal((await store.records()).length, 3);
  assert.equal(JSON.stringify(await store.records()).includes(grant.sturdyRef), false);
});
