import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CLASSIFICATIONS, judgmentProviderStatus } from "@/lib/judgment";

/**
 * The real provider, and the swap between it and the mock.
 *
 * The interface is the contract: nothing above it changes when the provider
 * does. What matters here is that every way the live one can go wrong ends in
 * the same place as the mock's uncertainty, which is a person.
 */

const ORIGINAL_KEY = process.env.TYPESAFE_API_KEY;

beforeEach(() => {
  vi.resetModules();
  delete process.env.TYPESAFE_API_KEY;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@typesafe-ai/sdk");
  if (ORIGINAL_KEY === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = ORIGINAL_KEY;
});

describe("provider selection is configuration, not code", () => {
  it("reports the mock when no credential is set", async () => {
    const status = judgmentProviderStatus();
    expect(status.live).toBe(false);
    expect(status.name).toBe("mock");

    const { getJudgmentProvider } = await import("@/lib/judgment");
    const provider = await getJudgmentProvider();
    expect(provider.isLive).toBe(false);
    expect(provider.name).toBe("mock");
  });

  it("reports the real provider once a credential is set", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    const { judgmentProviderStatus: status } = await import("@/lib/judgment/status");
    expect(status()).toEqual({ live: true, name: "typesafe" });
  });

  it("treats a blank credential as no credential", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "   ");
    const { judgmentProviderStatus: status } = await import("@/lib/judgment/status");
    expect(status().live).toBe(false);
  });

  it("offers the same three methods either way", async () => {
    const { MockJevProvider } = await import("@/lib/judgment");
    const { TypeSafeJevProvider } = await import("@/lib/judgment/TypeSafeJevProvider");
    const methods = ["classifyError", "classifyComplexity", "evaluateEvidenceState"] as const;
    for (const method of methods) {
      expect(typeof new MockJevProvider()[method]).toBe("function");
      expect(typeof new TypeSafeJevProvider()[method]).toBe("function");
    }
  });
});

describe("the live provider answers inside the closed vocabulary", () => {
  it("returns the label the service chose, with its confidence", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    vi.doMock("@typesafe-ai/sdk", () => ({
      choice: (instructions: string, criteria: unknown) => ({ instructions, criteria }),
      TypeSafeClient: class {
        async systemOne() {
          return {
            answers: { classification: { choice: "material_error", confidence: 0.87 } },
          };
        }
      },
    }));

    const { TypeSafeJevProvider } = await import("@/lib/judgment/TypeSafeJevProvider");
    const result = await new TypeSafeJevProvider().classifyError("A note.");
    expect(result.result).toBe("material_error");
    expect(result.confidence).toBe(0.87);
    expect(result.source).toBe("live");
  });

  it("narrows a label it does not recognise to uncertain", async () => {
    // The type system's guarantee ends at the network boundary, so a label we
    // never offered is not accepted just because it arrived.
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    vi.doMock("@typesafe-ai/sdk", () => ({
      choice: () => ({}),
      TypeSafeClient: class {
        async systemOne() {
          return { answers: { classification: { choice: "catastrophic", confidence: 0.99 } } };
        }
      },
    }));

    const { TypeSafeJevProvider } = await import("@/lib/judgment/TypeSafeJevProvider");
    const result = await new TypeSafeJevProvider().classifyError("A note.");
    expect(result.result).toBe("uncertain");
    expect(ERROR_CLASSIFICATIONS).toContain(result.result);
  });

  it("narrows a malformed reply to uncertain rather than trusting it", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    vi.doMock("@typesafe-ai/sdk", () => ({
      choice: () => ({}),
      TypeSafeClient: class {
        async systemOne() {
          return { answers: { classification: { choice: null, confidence: "high" } } };
        }
      },
    }));

    const { TypeSafeJevProvider } = await import("@/lib/judgment/TypeSafeJevProvider");
    const result = await new TypeSafeJevProvider().classifyError("A note.");
    expect(result.result).toBe("uncertain");
    expect(result.confidence).toBe(0);
  });
});

describe("every failure routes to a person", () => {
  it.each([
    ["authentication", "AuthenticationError"],
    ["rate limiting", "RateLimitError"],
    ["a timeout", "APITimeoutError"],
    ["a lost connection", "APIConnectionError"],
    ["an unexpected shape", "TypeError"],
  ])("returns uncertain on %s", async (_label, errorName) => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    vi.doMock("@typesafe-ai/sdk", () => ({
      choice: () => ({}),
      TypeSafeClient: class {
        async systemOne(): Promise<never> {
          const error = new Error("failed");
          error.name = errorName;
          throw error;
        }
      },
    }));

    const { TypeSafeJevProvider } = await import("@/lib/judgment/TypeSafeJevProvider");
    const result = await new TypeSafeJevProvider().classifyError("A note.");
    // Never a substantive classification. Never a guess.
    expect(result.result).toBe("uncertain");
    expect(result.confidence).toBe(0);
  });

  it("degrades to human review if the package itself cannot load", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-key");
    vi.doMock("@typesafe-ai/sdk", () => {
      throw new Error("module not found");
    });

    const { TypeSafeJevProvider } = await import("@/lib/judgment/TypeSafeJevProvider");
    const result = await new TypeSafeJevProvider().evaluateEvidenceState("A note.");
    expect(result.result).toBe("unclear");
  });
});

describe("the credential cannot leak", () => {
  const source = readFileSync("lib/judgment/TypeSafeJevProvider.ts", "utf8");

  it("is server-only", () => {
    expect(source).toContain('import "server-only"');
  });

  it("never enables browser use", () => {
    // The SDK refuses browsers unless told otherwise. It is never told otherwise.
    expect(source).not.toContain("dangerouslyAllowBrowser");
  });

  it("adds no second retry layer on top of the SDK's own", () => {
    expect(source).not.toMatch(/for\s*\(.*retry|retries\s*[<>]=?\s*\d/i);
  });

  it("keeps the panel that calls it free of any provider detail", () => {
    const panel = readFileSync("components/screen2/ClassificationPanel.tsx", "utf8");
    for (const term of ["TYPESAFE", "typesafe", "TypeSafeClient", "api.typesafe.ai"]) {
      expect(panel, term).not.toContain(term);
    }
    // It talks to our own route, which is what makes the swap invisible above.
    expect(panel).toContain("/api/judgment");
  });
});
