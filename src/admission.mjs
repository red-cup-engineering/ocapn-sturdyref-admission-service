import { sha256Digest, sha256Hex } from "@red-cup-engineering/semiotic-content-address-system";
import { randomBase64Url } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/integrity";
import { each, put } from "@red-cup-engineering/semiotic-eavt-engineering-services-section/store";
import { nowInstantText } from "@red-cup-engineering/time-data-engine";

const STURDYREF = /^urn:ocapn:sturdyref:[A-Za-z0-9_-]{43}$/u;
const TEXT = /^[^\u0000-\u001f\u007f]+$/u;

function requiredText(value, label) {
  if (typeof value !== "string" || !TEXT.test(value)) throw new TypeError(`${label} must be nonempty text`);
  return value;
}

function referenceDigest(sturdyRef) {
  if (!STURDYREF.test(sturdyRef ?? "")) throw new TypeError("one canonical OCapN sturdy reference is required");
  return sha256Digest(sturdyRef);
}

export function createSturdyRefStore({ root, now = nowInstantText } = {}) {
  requiredText(root, "store root");

  /** The sturdy-reference grants and admissions, oldest first, as rows of the `sturdyref-admission` records. */
  async function records() { return [...each(root, "sturdyref-admission")].map(({ record }) => record); }

  async function append(record) { put(root, "sturdyref-admission", record); return record; }

  return Object.freeze({
    async mint({ holder, locus }) {
      const sturdyRef = `urn:ocapn:sturdyref:${randomBase64Url(32)}`;
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
