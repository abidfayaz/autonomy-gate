import { describe, expect, it } from "vitest";
import { DEFAULT_STAGES, HIGH_CONFIDENCE_THRESHOLD } from "@/data/generator/specs.mts";
import type {
  AgentRun,
  AutonomyLevel,
  AutonomyMode,
  EvaluationCase,
  HumanReview,
  Incident,
  JevJudgment,
  PolicyVersion,
  Task,
} from "@/lib/domain/types";
import { evaluateTask, REASON_CODES, type EvaluationInput } from "@/lib/engine";
import { deriveDecisionOptions } from "@/lib/engine/decisionOptions";

/**
 * Branch coverage over synthetic inputs.
 *
 * The seeded dataset exercises the outcomes the product ships with; these build
 * inputs directly so every branch of the gate is reached, including the ones the
 * prototype deliberately never triggers.
 */

const WINDOW_START = "2026-01-01";

function makePolicy(overrides: Partial<PolicyVersion> = {}): PolicyVersion {
  return {
    policy_version_id: "test-policy-1.0",
    task_id: "test-task",
    version: "1.0",
    active: true,
    created_at: WINDOW_START,
    change_note: "",
    high_confidence_threshold: HIGH_CONFIDENCE_THRESHOLD,
    stages: DEFAULT_STAGES,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: "test-task",
    agent_id: "test-agent",
    name: "Test task",
    description: "",
    autonomy_ceiling: "constrained",
    current_level: "supervised",
    operational_state: "healthy",
    approved_scope: null,
    rule_pack_id: "test-rules",
    agent_rule_version: "1.0",
    evaluator_rule_version: "1.0",
    agent_version_id: "test-agent-v1",
    policy_version_id: "test-policy-1.0",
    material_change_pending: false,
    evidence_window_start: WINDOW_START,
    state_note: null,
    ...overrides,
  };
}

interface RunOptions {
  count: number;
  mode: AutonomyMode;
  incorrect?: number;
  confidentWrong?: number;
  critical?: number;
  evidenceMissing?: number;
  sampled?: number;
  sampledErrors?: number;
  boundaryViolations?: number;
  missedExceptions?: number;
  /** Spread evenly across the four segments unless a single one is named. */
  segment?: { jurisdiction: "AU" | "NZ"; complexity: "routine" | "complex" };
  criticalAcrossAllSegments?: boolean;
}

function makeRuns(options: RunOptions): { runs: AgentRun[]; cases: EvaluationCase[] } {
  const runs: AgentRun[] = [];
  const cases: EvaluationCase[] = [];
  const segments: Array<{ jurisdiction: "AU" | "NZ"; complexity: "routine" | "complex" }> =
    options.segment
      ? [options.segment]
      : [
          { jurisdiction: "NZ", complexity: "routine" },
          { jurisdiction: "AU", complexity: "routine" },
          { jurisdiction: "NZ", complexity: "complex" },
          { jurisdiction: "AU", complexity: "complex" },
        ];

  const criticalIndexes = new Set<number>();
  if (options.criticalAcrossAllSegments) {
    // One critical error inside each segment, so no segment is clean.
    for (let s = 0; s < segments.length; s += 1) criticalIndexes.add(s);
  } else {
    for (let i = 0; i < (options.critical ?? 0); i += 1) criticalIndexes.add(i);
  }

  for (let i = 0; i < options.count; i += 1) {
    const segment = segments[i % segments.length];
    if (!segment) continue;
    const incorrect = i < (options.incorrect ?? 0) || criticalIndexes.has(i);
    const confidentWrong = i < (options.confidentWrong ?? 0);
    const caseId = `CASE-${i}`;
    cases.push({
      case_id: caseId,
      task_id: "test-task",
      jurisdiction: segment.jurisdiction,
      complexity: segment.complexity,
      expected_result: "right",
      critical_exception_expected: false,
      evidence_required: true,
    });
    runs.push({
      run_id: `RUN-${i}`,
      case_id: caseId,
      task_id: "test-task",
      agent_version_id: "test-agent-v1",
      autonomy_mode: options.mode,
      agent_result: incorrect ? "wrong" : "right",
      confidence: incorrect ? (confidentWrong ? 0.95 : 0.7) : 0.95,
      correct: !incorrect,
      evidence_present: i >= (options.evidenceMissing ?? 0),
      agent_rule_version: "1.0",
      occurred_at: "2026-02-01",
      critical_error: criticalIndexes.has(i),
      post_execution_sampled: i < (options.sampled ?? 0),
      post_execution_error: i < (options.sampledErrors ?? 0),
      boundary_violation: i < (options.boundaryViolations ?? 0),
      missed_critical_exception: i < (options.missedExceptions ?? 0),
      escalation_expected: false,
    });
  }
  return { runs, cases };
}

function makeInput(
  task: Partial<Task>,
  runOptions: RunOptions,
  extra: {
    reviews?: HumanReview[];
    judgments?: JevJudgment[];
    incidents?: Incident[];
    currentRuleVersion?: string;
    policy?: PolicyVersion;
  } = {},
): EvaluationInput {
  const { runs, cases } = makeRuns(runOptions);
  return {
    task: makeTask(task),
    policy: extra.policy ?? makePolicy(),
    currentRuleVersion: extra.currentRuleVersion ?? "1.0",
    runs,
    reviews: extra.reviews ?? [],
    cases,
    judgments: extra.judgments ?? [],
    openIncidents: extra.incidents ?? [],
  };
}

/** A clean Supervised window that satisfies every Supervised-to-Constrained criterion. */
const healthySupervised: RunOptions = {
  count: 320,
  mode: "supervised",
  incorrect: 2,
  confidentWrong: 0,
  sampled: 40,
  sampledErrors: 0,
};

describe("gate branch order", () => {
  it("asks about a changed configuration before anything else", () => {
    const result = evaluateTask(
      makeInput(
        { material_change_pending: true, evaluator_rule_version: "0.9" },
        { count: 10, mode: "supervised", critical: 1 },
      ),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.SANDBOX_REVALIDATION_REQUIRED);
  });

  it("pauses on a version mismatch before counting evidence", () => {
    const result = evaluateTask(
      makeInput({ evaluator_rule_version: "0.9" }, { count: 5, mode: "supervised" }),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.PAUSED_RULE_VERSION_MISMATCH);
    expect(result.criteria).toBeNull();
  });

  it("pauses when the task itself is stale, not just the evaluator", () => {
    const result = evaluateTask(
      makeInput(
        { agent_rule_version: "0.9", evaluator_rule_version: "0.9" },
        { count: 320, mode: "supervised" },
      ),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.PAUSED_RULE_VERSION_MISMATCH);
  });

  it("holds on thin evidence before grading anything measured from it", () => {
    const result = evaluateTask(makeInput({}, { count: 12, mode: "supervised" }));
    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE);
    expect(result.criteria).toBeNull();
  });

  it("holds when required evidence is missing too often", () => {
    const result = evaluateTask(
      makeInput({}, { ...healthySupervised, evidenceMissing: 40 }),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_EVIDENCE_COVERAGE);
    expect(result.criteria).toBeNull();
  });

  it("blocks on an open blocking incident", () => {
    const incident: Incident = {
      incident_id: "INC-T1",
      task_id: "test-task",
      type: "safety",
      status: "open",
      opened_at: "2026-02-01",
      summary: "An unresolved safety issue is open.",
      affected_case_count: 3,
      blocking: true,
    };
    const result = evaluateTask(
      makeInput({}, healthySupervised, { incidents: [incident] }),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.BLOCKED_OPEN_INCIDENT);
    expect(result.criteria).toBeNull();
  });

  it("recommends the next level when every criterion is met", () => {
    const result = evaluateTask(makeInput({}, healthySupervised));
    expect(result.recommendation.code).toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
    expect(result.recommendation.recommended_level).toBe("constrained");
  });

  it("names confident-but-wrong when it is the only unmet criterion", () => {
    const result = evaluateTask(
      makeInput({}, { ...healthySupervised, incorrect: 8, confidentWrong: 8 }),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_CONFIDENT_WRONG_RATE);
  });

  it("falls back to a general hold when several criteria are unmet", () => {
    const result = evaluateTask(
      makeInput(
        {},
        {
          ...healthySupervised,
          incorrect: 8,
          confidentWrong: 8,
          sampled: 40,
          sampledErrors: 8,
          missedExceptions: 2,
        },
      ),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.REMAIN_AT_CURRENT_LEVEL);
    expect(result.criteria?.failed.length).toBeGreaterThan(1);
  });
});

describe("critical errors", () => {
  it("narrows the fence when the damage is confined to some segments", () => {
    const result = evaluateTask(
      makeInput({}, { ...healthySupervised, critical: 1, incorrect: 2 }),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.RESTRICT_SCOPE);
    expect(result.recommendation.recommended_level).toBe("supervised");
    expect(result.recommendation.recommended_scope).not.toBeNull();
    expect(result.recommendation.promotion_available).toBe(false);
  });

  it("recommends rollback when every segment is affected above Shadow", () => {
    const result = evaluateTask(
      makeInput({}, { ...healthySupervised, criticalAcrossAllSegments: true }),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.ROLLBACK_RECOMMENDED);
    expect(result.recommendation.recommended_level).toBe("assisted");
  });

  it("blocks rather than rolls back when already in Shadow", () => {
    const result = evaluateTask(
      makeInput(
        { current_level: "shadow" },
        { count: 240, mode: "shadow", incorrect: 2, criticalAcrossAllSegments: true },
      ),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.BLOCKED_CRITICAL_ERROR);
  });

  it("counts a human-confirmed critical classification as a critical error", () => {
    const judgment: JevJudgment = {
      judgment_id: "JDG-T1",
      run_id: "RUN-1",
      task_id: "test-task",
      question_id: "review-error-severity-v1",
      result: "critical_error",
      confidence: 0.93,
      requires_human_confirmation: true,
      human_confirmed_result: "critical_error",
      reviewer_note: "",
    };
    const clean = evaluateTask(makeInput({}, healthySupervised));
    const withCritical = evaluateTask(
      makeInput({}, healthySupervised, { judgments: [judgment] }),
    );

    expect(clean.metrics.critical_errors).toBe(0);
    expect(withCritical.metrics.critical_errors).toBe(1);
    expect(clean.recommendation.code).toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
    expect(withCritical.recommendation.code).not.toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
  });

  it("ignores a classification a human has not confirmed", () => {
    const pending: JevJudgment = {
      judgment_id: "JDG-T2",
      run_id: "RUN-1",
      task_id: "test-task",
      question_id: "review-error-severity-v1",
      result: "critical_error",
      confidence: 0.93,
      requires_human_confirmation: true,
      human_confirmed_result: null,
      reviewer_note: "",
    };
    const result = evaluateTask(makeInput({}, healthySupervised, { judgments: [pending] }));
    // An unconfirmed classification is not evidence and never silently becomes one.
    expect(result.metrics.critical_errors).toBe(0);
    expect(result.recommendation.code).toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
  });
});

describe("stage evidence isolation", () => {
  it("refuses to satisfy Assisted to Supervised with Shadow evidence", () => {
    // A flawless Shadow benchmark, re-run against a task that has already been
    // promoted to Assisted. The evidence is excellent and entirely inadmissible.
    const result = evaluateTask(
      makeInput({ current_level: "assisted" }, { count: 500, mode: "shadow", incorrect: 0 }),
    );
    expect(result.metrics.valid_case_count).toBe(0);
    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE);
  });

  it("refuses to satisfy Supervised to Constrained with Assisted evidence", () => {
    const result = evaluateTask(
      makeInput(
        { current_level: "supervised" },
        { count: 500, mode: "assisted", incorrect: 0 },
      ),
    );
    expect(result.metrics.valid_case_count).toBe(0);
    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE);
  });

  it("discards evidence generated before the current window opened", () => {
    const input = makeInput({ evidence_window_start: "2026-06-01" }, healthySupervised);
    const result = evaluateTask(input);
    // Every run occurred on 2026-02-01, before the window a material change opened.
    expect(result.metrics.valid_case_count).toBe(0);
    expect(result.recommendation.code).toBe(REASON_CODES.HOLD_INSUFFICIENT_STAGE_EVIDENCE);
  });

  it("never recommends a promotion that skips a level", () => {
    const perfectShadow: RunOptions = {
      count: 900,
      mode: "shadow",
      incorrect: 0,
      sampled: 300,
      sampledErrors: 0,
    };
    const result = evaluateTask(makeInput({ current_level: "shadow" }, perfectShadow));
    expect(result.recommendation.code).toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
    // Flawless on every measure, and still only one step.
    expect(result.recommendation.recommended_level).toBe("assisted");
  });
});

describe("ceilings", () => {
  it("stops at a ceiling below the top of the scale", () => {
    const result = evaluateTask(
      makeInput(
        { current_level: "supervised", autonomy_ceiling: "supervised" },
        healthySupervised,
      ),
    );
    expect(result.at_ceiling).toBe(true);
    expect(result.target_level).toBeNull();
    expect(result.recommendation.code).toBe(REASON_CODES.AT_AUTONOMY_CEILING);
    expect(result.recommendation.promotion_available).toBe(false);
  });

  it("still reports version alignment at the ceiling", () => {
    const result = evaluateTask(
      makeInput(
        {
          current_level: "supervised",
          autonomy_ceiling: "supervised",
          evaluator_rule_version: "0.9",
        },
        healthySupervised,
      ),
    );
    expect(result.recommendation.code).toBe(REASON_CODES.PAUSED_RULE_VERSION_MISMATCH);
  });
});

describe("unmeasurable criteria", () => {
  /** Every Assisted output reviewed and accepted, with nothing needing escalation. */
  const reviewedWithoutEscalations = (count: number): HumanReview[] =>
    Array.from({ length: count }, (_, index) => ({
      review_id: `REV-${index}`,
      run_id: `RUN-${index}`,
      task_id: "test-task",
      disposition: "accepted" as const,
      changed_result: false,
      reviewer: "Maya",
      note: null,
    }));

  it("reports not applicable, and does not block, when nothing needed escalating", () => {
    // The window gave no opportunity to observe escalation quality. That is
    // honestly reported rather than failed, and the stage still passes.
    const result = evaluateTask(
      makeInput(
        { current_level: "assisted" },
        { count: 240, mode: "assisted", incorrect: 2 },
        { reviews: reviewedWithoutEscalations(240) },
      ),
    );
    const escalation = result.criteria?.criteria.find(
      (criterion) => criterion.key === "correct-escalation",
    );
    expect(escalation?.passed).toBeNull();
    expect(escalation?.not_applicable_reason).toBe("No escalation cases");
    expect(result.criteria?.satisfied).toBe(true);
  });

  it("fails, rather than excusing, a mandatory criterion whose evidence is absent", () => {
    // Nobody reviewed anything at Assisted, so whether humans can rely on the
    // recommendation is unproven. That is a failure, not a free pass.
    const result = evaluateTask(
      makeInput({ current_level: "assisted" }, { count: 240, mode: "assisted", incorrect: 2 }),
    );
    const override = result.criteria?.criteria.find(
      (criterion) => criterion.key === "override-rate",
    );
    expect(override?.passed).toBe(false);
    expect(override?.not_applicable_reason).toContain("unproven");
    expect(result.criteria?.satisfied).toBe(false);
  });

  it("fails required sampling that never happened", () => {
    // A policy demanding 10% of completed cases be sampled is not satisfied by
    // sampling none of them.
    const result = evaluateTask(
      makeInput({}, { count: 320, mode: "supervised", incorrect: 2, sampled: 0 }),
    );
    const coverage = result.criteria?.criteria.find(
      (criterion) => criterion.key === "sample-coverage",
    );
    expect(coverage?.passed).toBe(false);
    expect(coverage?.not_applicable_reason).toContain("required sampling has not happened");
    expect(result.recommendation.code).not.toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
  });
});

describe("scope while the evidence cannot be trusted", () => {
  it("offers narrowing, but proposes no segments of its own", () => {
    // Reducing exposure is conservative and stays available. Proposing which
    // segments to keep would derive a recommendation from the very evaluation
    // the product has just declared untrustworthy.
    const task = makeTask({ evaluator_rule_version: "0.9", approved_scope: null });
    const result = evaluateTask(
      makeInput({ evaluator_rule_version: "0.9" }, healthySupervised),
    );
    const options = deriveDecisionOptions(result, task);
    const restrict = options.find((option) => option.action === "restrict-scope");

    expect(result.recommendation.code).toBe(REASON_CODES.PAUSED_RULE_VERSION_MISMATCH);
    expect(restrict).toBeDefined();
    expect(restrict?.scope).toBeNull();
    expect(restrict?.description).toContain("no segments are proposed");
    // And promotion stays unavailable regardless.
    expect(options.find((option) => option.action === "approve-next")).toBeUndefined();
  });
});

describe("determinism", () => {
  it("returns the same outcome for the same input, every time", () => {
    const input = makeInput({}, healthySupervised);
    const first = evaluateTask(input);
    const second = evaluateTask(input);
    const third = evaluateTask(makeInput({}, healthySupervised));
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(JSON.stringify(third)).toBe(JSON.stringify(first));
  });

  it("does not mutate its input", () => {
    const input = makeInput({}, healthySupervised);
    const before = JSON.stringify(input);
    evaluateTask(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("policy drives the outcome", () => {
  it("flips a hold into a promotion when the threshold is loosened", () => {
    const runOptions: RunOptions = {
      ...healthySupervised,
      incorrect: 8,
      confidentWrong: 8,
    };
    const strict = evaluateTask(makeInput({}, runOptions));
    const loose = evaluateTask(
      makeInput({}, runOptions, {
        policy: makePolicy({
          version: "1.1",
          stages: {
            ...DEFAULT_STAGES,
            supervised_to_constrained: {
              ...DEFAULT_STAGES.supervised_to_constrained,
              max_confident_wrong_rate: 0.5,
            },
          },
        }),
      }),
    );

    expect(strict.recommendation.code).toBe(REASON_CODES.HOLD_CONFIDENT_WRONG_RATE);
    expect(loose.recommendation.code).toBe(REASON_CODES.ELIGIBLE_FOR_NEXT_LEVEL);
  });

  it("uses the policy's own high-confidence threshold", () => {
    const runOptions: RunOptions = { ...healthySupervised, incorrect: 8, confidentWrong: 8 };
    const standard = evaluateTask(makeInput({}, runOptions));
    const lenient = evaluateTask(
      makeInput({}, runOptions, {
        policy: makePolicy({ high_confidence_threshold: 0.99 }),
      }),
    );
    // The same runs, judged confident at 0.90 and not confident at 0.99.
    expect(standard.metrics.confident_wrong_count).toBe(8);
    expect(lenient.metrics.confident_wrong_count).toBe(0);
  });
});

const LEVELS: AutonomyLevel[] = ["shadow", "assisted", "supervised", "constrained"];

describe("stage selection", () => {
  it("selects the stage from the level the task is trying to leave", () => {
    const expected: Record<string, string | null> = {
      shadow: "shadow_to_assisted",
      assisted: "assisted_to_supervised",
      supervised: "supervised_to_constrained",
      constrained: null,
    };
    for (const level of LEVELS) {
      const result = evaluateTask(
        makeInput({ current_level: level }, { count: 4, mode: level }),
      );
      expect(result.stage).toBe(expected[level]);
    }
  });
});
