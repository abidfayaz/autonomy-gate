/**
 * mulberry32: a small, fast, fully deterministic PRNG.
 *
 * Used only for incidental detail (confidence jitter, ordering, vendor labels).
 * Nothing the product measures depends on it: every count that a metric is
 * derived from is declared explicitly in `specs.ts`, so the dataset would carry
 * the same meaning even if this generator produced different noise.
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max), rounded to `places`. */
export function randomFloat(rng: () => number, min: number, max: number, places = 2): number {
  const value = min + rng() * (max - min);
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Deterministic pick from a non-empty list. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick() called with an empty list");
  return item;
}

/** Zero-padded sequence id, e.g. `RUN-0042`. */
export function sequenceId(prefix: string, index: number, width = 4): string {
  return `${prefix}-${String(index).padStart(width, "0")}`;
}

/** Adds whole days to an ISO date, staying in UTC so output never shifts by locale. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  return result;
}

/** Whole days between two ISO dates. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00.000Z`).getTime();
  const to = new Date(`${toIso}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / 86400000);
}
