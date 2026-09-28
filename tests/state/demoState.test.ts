import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MetricSnapshot } from "@/lib/domain/types";
import {
  clearDemoState,
  DEMO_STATE_KEY,
  EMPTY_DEMO_STATE,
  effectiveLevel,
  effectiveScope,
  hasVisitorChanges,
  latestDecisionFor,
  loadDemoState,
  nextDecisionId,
  saveDemoState,
  type DemoState,
  type RecordedDecision,
} from "@/lib/state/demoState";

const snapshot: MetricSnapshot = {
  task_id: "t",
  autonomy_mode: "supervised",
  valid_case_count: 342,
  accuracy: 0.985,
  critical_errors: 0,
  confident_wrong_rate: 0.0088,
  evidence_coverage: 0.991,
  human_acceptance_rate: 0.94,
  human_override_rate: 0.03,
  correct_escalation_rate: 1,
  sample_coverage: 0.12,
  sampled_error_rate: 0,
  boundary_violations: 0,
  missed_critical_exceptions: 0,
};

const decision = (overrides: Partial<RecordedDecision> = {}): RecordedDecision => ({
  decision_id: "DEC-S001",
  task_id: "routine-rule-application",
  decided_at: "2026-09-28",
  current_level: "supervised",
  recommended_level: "supervised",
  recommendation_code: "HOLD_CONFIDENT_WRONG_RATE",
  final_level: "constrained",
  outcome: "approved",
  was_override: true,
  scope: null,
  decided_by: "Maya",
  reason: "Recorded for the audit history.",
  reason_category: "Business context",
  policy_version: "1.3",
  agent_version: "tax-helper-v2",
  rule_version: "3.2",
  evaluator_rule_version: "3.2",
  snapshot,
  confirmed_classifications: [],
  ...overrides,
});

beforeEach(() => {
  globalThis.localStorage?.clear();
  vi.restoreAllMocks();
});

describe("persistence", () => {
  it("starts empty and round-trips a decision", () => {
    expect(loadDemoState()).toEqual(EMPTY_DEMO_STATE);
    const state: DemoState = { version: 1, decisions: [decision()], policies: [], classifications: [] };
    saveDemoState(state);
    expect(loadDemoState()).toEqual(state);
  });

  it("clears back to the seeded state", () => {
    saveDemoState({ version: 1, decisions: [decision()], policies: [], classifications: [] });
    clearDemoState();
    expect(loadDemoState()).toEqual(EMPTY_DEMO_STATE);
    expect(hasVisitorChanges(loadDemoState())).toBe(false);
  });

  it("discards unrecognised stored data rather than half-reading it", () => {
    globalThis.localStorage.setItem(DEMO_STATE_KEY, "{not json");
    expect(loadDemoState()).toEqual(EMPTY_DEMO_STATE);

    globalThis.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify({ version: 99 }));
    expect(loadDemoState()).toEqual(EMPTY_DEMO_STATE);

    globalThis.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify({ version: 1 }));
    expect(loadDemoState()).toEqual(EMPTY_DEMO_STATE);
  });

  it("survives storage being unavailable", () => {
    // A private window, or blocked site data, makes these throw outright.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadDemoState()).toEqual(EMPTY_DEMO_STATE);
    expect(() => saveDemoState({ version: 1, decisions: [decision()], policies: [], classifications: [] })).not.toThrow();
    expect(() => clearDemoState()).not.toThrow();
  });
});

describe("applying decisions", () => {
  it("uses the seeded level until a decision is recorded", () => {
    expect(effectiveLevel(EMPTY_DEMO_STATE, "routine-rule-application", "supervised")).toBe(
      "supervised",
    );
  });

  it("uses the level the latest decision left the task at", () => {
    const state: DemoState = {
      version: 1,
      decisions: [
        decision({ decision_id: "DEC-S001", final_level: "constrained" }),
        decision({ decision_id: "DEC-S002", final_level: "assisted" }),
      ],
      policies: [],
      classifications: [],
    };
    expect(effectiveLevel(state, "routine-rule-application", "supervised")).toBe("assisted");
    expect(latestDecisionFor(state, "routine-rule-application")?.decision_id).toBe("DEC-S002");
  });

  it("leaves other tasks alone", () => {
    const state: DemoState = { version: 1, decisions: [decision()], policies: [], classifications: [] };
    expect(effectiveLevel(state, "risk-detection", "shadow")).toBe("shadow");
  });

  it("applies a narrowed scope, including clearing one", () => {
    const fence = {
      label: "Routine NZ",
      included: ["Routine NZ cases"],
      excluded: ["Complex cases"],
    };
    const restricted: DemoState = { version: 1, decisions: [decision({ scope: fence })], policies: [], classifications: [] };
    expect(effectiveScope(restricted, "routine-rule-application", null)).toEqual(fence);

    const cleared: DemoState = { version: 1, decisions: [decision({ scope: null })], policies: [], classifications: [] };
    expect(effectiveScope(cleared, "routine-rule-application", fence)).toBeNull();
  });

  it("numbers visitor decisions so they never collide with seeded ids", () => {
    expect(nextDecisionId(EMPTY_DEMO_STATE)).toBe("DEC-S001");
    expect(nextDecisionId({ version: 1, decisions: [decision()], policies: [], classifications: [] })).toBe("DEC-S002");
  });
});

describe("the frozen snapshot", () => {
  it("keeps the evidence exactly as it stood, not as it stands now", () => {
    const recorded = decision();
    saveDemoState({ version: 1, decisions: [recorded], policies: [], classifications: [] });
    const loaded = loadDemoState();
    expect(loaded.decisions[0]?.snapshot).toEqual(snapshot);
    expect(loaded.decisions[0]?.snapshot.confident_wrong_rate).toBe(0.0088);
    expect(loaded.decisions[0]?.policy_version).toBe("1.3");
  });

  it("keeps the reason and the reviewer with the decision", () => {
    saveDemoState({ version: 1, decisions: [decision()], policies: [], classifications: [] });
    const loaded = loadDemoState().decisions[0];
    expect(loaded?.decided_by).toBe("Maya");
    expect(loaded?.reason.length).toBeGreaterThan(0);
    expect(loaded?.was_override).toBe(true);
    expect(loaded?.recommendation_code).toBe("HOLD_CONFIDENT_WRONG_RATE");
  });
});
