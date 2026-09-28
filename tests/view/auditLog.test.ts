import { describe, expect, it } from "vitest";
import { decisions as seededDecisions } from "@/lib/data/seed";
import type { MetricSnapshot } from "@/lib/domain/types";
import type { RecordedDecision } from "@/lib/state/demoState";
import { buildAuditView, countRows, rowFromRecordedDecision, snapshotRows } from "@/lib/view/auditLog";

const view = buildAuditView();

describe("the seeded record", () => {
  it("carries every seeded event", () => {
    expect(view.rows).toHaveLength(8);
    for (const row of view.rows) {
      expect(row.source).toBe("seeded");
      expect(row.occurred_at).toMatch(/^2026-/);
    }
  });

  it("counts each kind of event from the rows themselves", () => {
    expect(view.counts.autonomy_decisions).toBe(3);
    expect(view.counts.policy_changes).toBe(2);
    expect(view.counts.revalidations).toBe(2);
    expect(view.counts.needs_attention).toBe(1);
  });

  it("orders newest first", () => {
    const dates = view.rows.map((row) => row.occurred_at);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
  });

  it("names the agent and task for every row", () => {
    for (const row of view.rows) {
      expect(row.agent_name.length, row.event_id).toBeGreaterThan(0);
      expect(row.task_name.length, row.event_id).toBeGreaterThan(0);
    }
  });

  it("describes a revalidation that confirmed a level, rather than an arrow to itself", () => {
    const continuity = view.rows.find((row) => row.detail?.decision_id === "DEC-003");
    expect(continuity?.change_from).toBe("L3 · Supervised");
    expect(continuity?.change_to).toBe("Continued L3 · Supervised");
  });

  it("records a declined recommendation as declined, with the level retained", () => {
    const declined = view.rows.find((row) => row.status === "Recommendation declined");
    expect(declined?.task_name).toBe("Detect invoice exceptions");
    expect(declined?.change_to).toContain("Retained");
    expect(declined?.detail?.was_override).toBe(true);
    // The recommendation the human disagreed with is kept alongside the decision.
    expect(declined?.detail?.recommended_label).toBe("L1 · Shadow");
    expect(declined?.detail?.final_level_label).toBe("L2 · Assisted");
  });

  it("logs the paused task as a version issue raised by the system", () => {
    const issue = view.rows.find((row) => row.type === "version-issue");
    expect(issue?.task_name).toBe("Draft tax position");
    expect(issue?.actor).toBe("System");
    expect(issue?.status).toBe("Needs attention");
  });
});

describe("decision detail answers the audit questions", () => {
  const detail = view.rows.find((row) => row.detail !== null)?.detail;

  it("says what, who, why, and under which versions", () => {
    expect(detail).toBeDefined();
    if (!detail) return;
    expect(detail.previous_level_label).toMatch(/^L[1-4]/);
    expect(detail.final_level_label).toMatch(/^L[1-4]/);
    expect(detail.decided_by).toBe("Maya");
    expect(detail.reason.length).toBeGreaterThan(10);
    expect(detail.policy_version).toMatch(/^v/);
    expect(detail.agent_version.length).toBeGreaterThan(0);
    expect(detail.rule_version).toMatch(/^v/);
    expect(detail.evaluator_rule_version).toMatch(/^v/);
  });

  it("carries the evidence snapshot rather than a pointer to it", () => {
    expect(detail?.snapshot_rows.length).toBe(13);
    const labels = detail?.snapshot_rows.map((row) => row.label) ?? [];
    expect(labels).toContain("Valid cases");
    expect(labels).toContain("Confident-but-wrong");
    expect(labels).toContain("Boundary violations");
  });

  it("shows a metric that did not apply as absent, not as zero", () => {
    // The L2 to L3 decision has no post-execution sampling, because nothing was
    // running without pre-approval yet. Rendering that as 0% would be a claim.
    const promotion = view.rows.find(
      (row) => row.detail?.decision_id === "DEC-001",
    )?.detail;
    const sample = promotion?.snapshot_rows.find((row) => row.label === "Sample coverage");
    expect(sample?.value).toBe("—");
  });
});

describe("history is never recalculated", () => {
  it("reads a decision's evidence from the snapshot taken at the time", () => {
    // DEC-001 was recorded on 240 Assisted-mode cases. Routine rule application
    // today reports 342 Supervised-mode cases; the record must not follow.
    const promotion = view.rows.find(
      (row) => row.detail?.decision_id === "DEC-001",
    )?.detail;
    const cases = promotion?.snapshot_rows.find((row) => row.label === "Valid cases");
    expect(cases?.value).toBe("240");

    const mode = promotion?.snapshot_rows.find((row) => row.label === "Evidence mode");
    expect(mode?.value).toBe("Assisted");
  });

  it("keeps the policy version in force at the time, not the current one", () => {
    const promotion = view.rows.find(
      (row) => row.detail?.decision_id === "DEC-001",
    )?.detail;
    // The task is governed by v1.3 today; this decision was made under v1.2.
    expect(promotion?.policy_version).toBe("v1.2");
  });

  it("keeps the rule version in force at the time", () => {
    const promotion = view.rows.find(
      (row) => row.detail?.decision_id === "DEC-001",
    )?.detail;
    expect(promotion?.rule_version).toBe("v3.1");
  });

  it("matches the seeded decision exactly, field for field", () => {
    for (const decision of seededDecisions) {
      const detail = view.rows.find(
        (row) => row.detail?.decision_id === decision.decision_id,
      )?.detail;
      if (!detail) continue;
      expect(detail.reason).toBe(decision.reason);
      expect(detail.decided_at).toBe(decision.decided_at);
      expect(detail.policy_version).toBe(`v${decision.policy_version}`);
    }
  });
});

describe("a visitor's own decisions", () => {
  const snapshot: MetricSnapshot = {
    task_id: "routine-rule-application",
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

  const recorded: RecordedDecision = {
    decision_id: "DEC-S001",
    task_id: "routine-rule-application",
    decided_at: "2026-09-28",
    current_level: "supervised",
    recommended_level: "supervised",
    recommendation_code: "HOLD_CONFIDENT_WRONG_RATE",
    final_level: "constrained",
    outcome: "approved",
    was_override: true,
    scope: { label: "Routine", included: ["Routine NZ cases"], excluded: ["Complex cases"] },
    decided_by: "Maya",
    reason: "Accepting the residual risk for this quarter.",
    reason_category: "Business context",
    policy_version: "1.3",
    agent_version: "tax-helper-v2",
    rule_version: "3.2",
    evaluator_rule_version: "3.2",
    snapshot,
    confirmed_classifications: [],
  };

  const row = rowFromRecordedDecision(recorded, view.lookups);

  it("is marked as belonging to this session, not to the seeded history", () => {
    expect(row.source).toBe("this-session");
    expect(row.detail?.source).toBe("this-session");
  });

  it("resolves the agent and task names", () => {
    expect(row.task_name).toBe("Routine rule application");
    expect(row.agent_name).toBe("Tax Helper");
  });

  it("carries the same frozen snapshot the decision was recorded with", () => {
    const cases = row.detail?.snapshot_rows.find((item) => item.label === "Valid cases");
    const confidentWrong = row.detail?.snapshot_rows.find(
      (item) => item.label === "Confident-but-wrong",
    );
    expect(cases?.value).toBe("342");
    expect(confidentWrong?.value).toBe("0.88%");
  });

  it("keeps the reason category a visitor chose", () => {
    expect(row.detail?.reason_category).toBe("Business context");
  });

  it("shows a declined recommendation as retaining the level", () => {
    const declined = rowFromRecordedDecision(
      {
        ...recorded,
        outcome: "recommendation-declined",
        final_level: "supervised",
      },
      view.lookups,
    );
    expect(declined.status).toBe("Recommendation declined");
    expect(declined.change_to).toBe("Retained L3 · Supervised");
  });

  it("joins the totals once merged", () => {
    const merged = [row, ...view.rows];
    expect(countRows(merged).autonomy_decisions).toBe(view.counts.autonomy_decisions + 1);
  });
});

describe("snapshot formatting", () => {
  it("renders small rates to two decimals and absent ones as a dash", () => {
    const rows = snapshotRows({
      task_id: "t",
      autonomy_mode: "shadow",
      valid_case_count: 200,
      accuracy: 0.982,
      critical_errors: 0,
      confident_wrong_rate: 0.0045,
      evidence_coverage: 0.987,
      human_acceptance_rate: null,
      human_override_rate: null,
      correct_escalation_rate: null,
      sample_coverage: null,
      sampled_error_rate: null,
      boundary_violations: 0,
      missed_critical_exceptions: 0,
    });
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
    expect(byLabel["Confident-but-wrong"]).toBe("0.45%");
    expect(byLabel["Accuracy"]).toBe("98.2%");
    expect(byLabel["Human override"]).toBe("—");
    expect(byLabel["Sample coverage"]).toBe("—");
  });
});
