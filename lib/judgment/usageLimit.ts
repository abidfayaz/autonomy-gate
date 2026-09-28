import "server-only";

/**
 * Usage protection for the live classification layer on a public prototype.
 *
 * Deliberately the lightest thing that works, and deliberately honest about what
 * it is not:
 *
 *  - It is **best effort**. Counters live in the memory of one serverless
 *    instance, so they reset on a cold start and are not shared between
 *    concurrent instances. A determined abuser spread across instances is not
 *    stopped by this. The hard guarantee is the spend cap set at the provider;
 *    this exists to stop the realistic case, which is one person holding down a
 *    button or looping curl.
 *  - It never fails a request. Exceeding a limit selects the seeded provider
 *    instead of the live one, which is a path the product already supports and
 *    discloses. A governance prototype that broke under load would be arguing
 *    against itself.
 *  - It is not in the autonomy path. Nothing here can change a recommendation:
 *    the engine does not import it, and a classification only becomes evidence
 *    once a person settles it.
 */

/** Calls a single visitor may make back to back. Generous enough that clicking
 *  several times to watch the confidence move is unaffected. */
const BURST = 8;

/** One call is returned to a visitor's allowance every this many milliseconds. */
const REFILL_MS = 15_000;

/** Ceiling across every visitor in one UTC day, as a second line of defence. */
const DAILY_CEILING = 400;

/** Upper bound on tracked visitors, so the map cannot grow without limit. */
const MAX_TRACKED = 5_000;

interface Bucket {
  tokens: number;
  /** When the tokens were last accounted for, not when the visitor last called. */
  last: number;
}

const buckets = new Map<string, Bucket>();
let currentDay = "";
let dayCount = 0;

export type LimitReason = "visitor" | "daily";

export interface LimitDecision {
  allowed: boolean;
  reason?: LimitReason;
}

/**
 * Identifies a caller well enough to throttle it.
 *
 * The forwarded address is spoofable, which is another reason this is a speed
 * bump rather than a guarantee. It is not stored, not logged and not used for
 * anything but the counter below.
 */
export function visitorKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

/**
 * Drops one unit from the caller's allowance and the day's, if both permit it.
 *
 * `now` is injectable so the behaviour can be tested without waiting for real
 * time to pass.
 */
export function consumeLiveCall(key: string, now: number = Date.now()): LimitDecision {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== currentDay) {
    currentDay = today;
    dayCount = 0;
  }

  if (dayCount >= DAILY_CEILING) return { allowed: false, reason: "daily" };

  const existing = buckets.get(key);
  const bucket: Bucket = existing ?? { tokens: BURST, last: now };

  // Refill in whole units, keeping the remainder so repeated calls cannot earn
  // a token by arriving often.
  const gained = Math.floor((now - bucket.last) / REFILL_MS);
  let tokens = Math.min(BURST, bucket.tokens + gained);
  let last = gained > 0 ? bucket.last + gained * REFILL_MS : bucket.last;
  if (tokens === BURST) last = now;

  if (tokens < 1) {
    buckets.set(key, { tokens, last });
    return { allowed: false, reason: "visitor" };
  }

  tokens -= 1;
  if (!existing) evictIfCrowded(now);
  buckets.set(key, { tokens, last });
  dayCount += 1;
  return { allowed: true };
}

/**
 * Forgets visitors whose allowance has fully recovered.
 *
 * A full bucket is indistinguishable from a visitor who has never called, so
 * dropping it costs nothing. Only runs when the map is at its bound.
 */
function evictIfCrowded(now: number): void {
  if (buckets.size < MAX_TRACKED) return;
  for (const [key, bucket] of buckets) {
    const recovered = Math.min(BURST, bucket.tokens + Math.floor((now - bucket.last) / REFILL_MS));
    if (recovered >= BURST) buckets.delete(key);
  }
  // Still full of active visitors: drop the oldest entry so one key can always
  // be admitted, rather than turning the bound into a refusal.
  if (buckets.size >= MAX_TRACKED) {
    const oldest = buckets.keys().next();
    if (!oldest.done) buckets.delete(oldest.value);
  }
}

/** Test seam. Never called by the application. */
export function resetUsageLimitForTests(): void {
  buckets.clear();
  currentDay = "";
  dayCount = 0;
}

export const USAGE_LIMITS = { BURST, REFILL_MS, DAILY_CEILING, MAX_TRACKED } as const;
