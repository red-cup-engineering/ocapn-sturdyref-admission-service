import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join } from "node:path";

const STURDYREF = /^urn:ocapn:sturdyref:[A-Za-z0-9_-]{43}$/u;
const TEXT = /^[^\u0000-\u001f\u007f]+$/u;

function requiredText(value, label) {
  if (typeof value !== "string" || !TEXT.test(value)) throw new TypeError(`${label} must be nonempty text`);
  return value;
}

function referenceDigest(sturdyRef) {
  if (!STURDYREF.test(sturdyRef ?? "")) throw new TypeError("one canonical OCapN sturdy reference is required");
  return `sha256:${createHash("sha256").update(sturdyRef).digest("hex")}`;
}

export function createSturdyRefStore({ root, now = () => new Date().toISOString() } = {}) {
  const ledger = join(requiredText(root, "store root"), "ocapn-sturdyref-admission.jsonl");

  async function records() {
    try {
      return (await readFile(ledger, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function append(record) {
    await mkdir(dirname(ledger), { recursive: true });
    await appendFile(ledger, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
    return record;
  }

  return Object.freeze({
    async mint({ holder, locus }) {
      const sturdyRef = `urn:ocapn:sturdyref:${randomBytes(32).toString("base64url")}`;
      const record = Object.freeze({
        type: "OCapNSturdyRefGrant",
        referenceDigest: referenceDigest(sturdyRef),
        holder: requiredText(holder, "holder"),
        locus: requiredText(locus, "locus"),
        grantedAt: now(),
      });
      await append(record);
      return Object.freeze({ type: "OCapNSturdyRef", sturdyRef, holder: record.holder, locus: record.locus });
    },
    async admit({ sturdyRef, locus }) {
      const digest = referenceDigest(sturdyRef);
      const expectedLocus = requiredText(locus, "locus");
      const grant = (await records()).findLast(
        (record) => record.type === "OCapNSturdyRefGrant" && record.referenceDigest === digest,
      );
      const admitted = grant !== undefined && grant.locus === expectedLocus;
      const receipt = Object.freeze({
        type: "OCapNSturdyRefAdmission",
        referenceDigest: digest,
        locus: expectedLocus,
        holder: grant?.holder ?? null,
        admitted,
        reason: admitted ? null : grant === undefined ? "unknown-sturdyref" : "locus-not-granted",
        observedAt: now(),
      });
      await append(receipt);
      return receipt;
    },
    records,
  });
}
