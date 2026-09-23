/**
 * Claims that need evidence. `kind` groups them so an allowance can approve a
 * category rather than a regex, and so the report says what sort of problem it
 * is rather than only which word matched.
 */
export const BANNED = [
  ["arrival-time", /\b\d+\s*-?\s*minute\b/i, "a specific arrival or response time"],
  ["arrival-time", /\bwithin\s+\d+\s*(min|minutes|hours?)\b/i, "a specific arrival or response time"],
  ["guarantee", /\bguarantee/i, "a guarantee"],
  ["warranty", /\bwarrant(y|ies)\b/i, "a warranty"],
  ["credential", /\blicensed\b/i, "a licence"],
  ["credential", /\binsured\b/i, "insurance"],
  ["credential", /\bbonded\b/i, "a bond"],
  ["credential", /\bcertified\b/i, "a certification"],
  ["credential", /\baccredited\b/i, "an accreditation"],
  ["tenure", /\b(\d+|\w+)\s+years\s+(of\s+)?(experience|in business)\b/i, "years in business"],
  ["tenure", /\bsince\s+(19|20)\d{2}\b/i, "a founding year"],
  ["ownership", /\bfamily[-\s]owned\b/i, "how the business is owned"],
  ["superlative", /\b(best|cheapest|lowest)\s+(price|rate|cost)/i, "a price superlative"],
  ["superlative", /\b(number\s*one|#1|no\.?\s*1)\b/i, "a ranking claim"],
  ["award", /\b(award[-\s]winning|voted\s+best)\b/i, "an award"],
  ["price", /\$\s?\d/, "a price"],
  ["volume", /\b\d[\d,]{2,}\+?\s+(customers|clients|jobs|projects)\b/i, "a customer or job count"],
];

/** Every claim in `text` whose kind is not in `allowedKinds`. */
export function findClaims(text, allowedKinds) {
  const hits = [];
  for (const [kind, re, describes] of BANNED) {
    if (allowedKinds.has(kind)) continue;
    const match = String(text).match(re);
    if (match) hits.push({ kind, describes, quote: match[0].trim() });
  }
  return hits;
}
