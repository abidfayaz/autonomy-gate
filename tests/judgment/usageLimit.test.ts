import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeLiveCall,
  resetUsageLimitForTests,
  USAGE_LIMITS,
  visitorKey,
} from "@/lib/judgment/usageLimit";

/**
 * The limiter is a cost control, not a security boundary, and these tests hold it
 * to that: a normal visitor is never impeded, a loop is, and the day has a
 * ceiling. Time is injected so none of this waits on the clock.
 */

beforeEach(() => {
  resetUsageLimitForTests();
});

const T0 = Date.parse("2026-09-29T12:00:00.000Z");

describe("a visitor using the demo normally", () => {
  it("is never blocked while looking at the confidence move", () => {
    // Four clicks in a few seconds, which is what the demo script asks for.
    for (let i = 0; i < 4; i++) {
      expect(consumeLiveCall("visitor", T0 + i * 800).allowed).toBe(true);
    }
  });

  it("may use the whole burst back to back", () => {
    for (let i = 0; i < USAGE_LIMITS.BURST; i++) {
      expect(consumeLiveCall("visitor", T0 + i * 100).allowed).toBe(true);
    }
  });
});

describe("a visitor in a loop", () => {
  it("is stopped once the burst is spent", () => {
    for (let i = 0; i < USAGE_LIMITS.BURST; i++) {
      consumeLiveCall("looper", T0);
    }
    const next = consumeLiveCall("looper", T0);
    expect(next.allowed).toBe(false);
    expect(next.reason).toBe("visitor");
  });

  it("earns one call back after the refill interval, and no more", () => {
    for (let i = 0; i < USAGE_LIMITS.BURST; i++) consumeLiveCall("looper", T0);

    const afterOneInterval = T0 + USAGE_LIMITS.REFILL_MS;
    expect(consumeLiveCall("looper", afterOneInterval).allowed).toBe(true);
    expect(consumeLiveCall("looper", afterOneInterval).allowed).toBe(false);
  });

  it("cannot earn a token by calling more often", () => {
    for (let i = 0; i < USAGE_LIMITS.BURST; i++) consumeLiveCall("looper", T0);

    // Twenty rejected attempts spread over less than one refill interval.
    const step = Math.floor(USAGE_LIMITS.REFILL_MS / 25);
    for (let i = 1; i <= 20; i++) {
      expect(consumeLiveCall("looper", T0 + i * step).allowed).toBe(false);
    }
    // The remainder was kept, so the token still arrives on schedule and not early.
    expect(consumeLiveCall("looper", T0 + USAGE_LIMITS.REFILL_MS - 1).allowed).toBe(false);
    expect(consumeLiveCall("looper", T0 + USAGE_LIMITS.REFILL_MS).allowed).toBe(true);
  });

  it("does not spend another visitor's allowance", () => {
    for (let i = 0; i < USAGE_LIMITS.BURST; i++) consumeLiveCall("looper", T0);
    expect(consumeLiveCall("looper", T0).allowed).toBe(false);
    expect(consumeLiveCall("someone-else", T0).allowed).toBe(true);
  });
});

describe("the daily ceiling", () => {
  it("holds across visitors, so many callers cannot outspend it together", () => {
    let allowed = 0;
    // Each caller is fresh, so only the day's ceiling can stop them.
    for (let i = 0; i < USAGE_LIMITS.DAILY_CEILING + 50; i++) {
      if (consumeLiveCall(`caller-${i}`, T0).allowed) allowed += 1;
    }
    expect(allowed).toBe(USAGE_LIMITS.DAILY_CEILING);
    expect(consumeLiveCall("another", T0).reason).toBe("daily");
  });

  it("resets on the next UTC day", () => {
    for (let i = 0; i < USAGE_LIMITS.DAILY_CEILING; i++) consumeLiveCall(`caller-${i}`, T0);
    expect(consumeLiveCall("late", T0).allowed).toBe(false);

    const tomorrow = Date.parse("2026-09-30T00:00:00.000Z");
    expect(consumeLiveCall("late", tomorrow).allowed).toBe(true);
  });
});

describe("identifying a caller", () => {
  it("uses the first forwarded address", () => {
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.2" },
    });
    expect(visitorKey(request)).toBe("203.0.113.7");
  });

  it("falls back to the real-ip header, then to a shared bucket", () => {
    expect(
      visitorKey(new Request("https://example.test", { headers: { "x-real-ip": "203.0.113.9" } })),
    ).toBe("203.0.113.9");
    expect(visitorKey(new Request("https://example.test"))).toBe("unknown");
  });
});

// That the engine cannot reach this module is asserted where that guarantee
// already lives, in tests/engine/purity.test.ts, which now forbids the engine
// from importing anything under lib/judgment at all.
