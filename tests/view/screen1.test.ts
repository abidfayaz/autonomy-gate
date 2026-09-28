import { describe, expect, it } from "vitest";
import { tasks } from "@/lib/data/seed";
import { buildScreen1View, parseTaskFilter } from "@/lib/view/agentsAndTasks";

/**
 * Screen 1's view model. Every number here has to be counted from task state,
 * which is the specific failure the reference mockups had: their summary said
 * one thing and their tables said another.
 */

describe("summary counts", () => {
  const view = buildScreen1View();

  it("counts agents and tasks from the data", () => {
    expect(view.summary.agent_count).toBe(2);
    expect(view.summary.task_count).toBe(tasks.length);
    expect(view.summary.task_count).toBe(8);
  });

  it("counts Needs Attention as paused plus needs-review, and nothing else", () => {
    const expected = tasks.filter(
      (task) => task.operational_state === "paused" || task.operational_state === "needs-review",
    ).length;
    expect(view.summary.needs_attention).toBe(expected);
    expect(view.summary.needs_attention).toBe(1);
  });

  it("counts Sandbox separately, so the same task is never counted twice", () => {
    expect(view.summary.sandbox_count).toBe(1);
    const sandboxTask = tasks.find((task) => task.operational_state === "sandbox");
    expect(sandboxTask?.task_id).toBe("filing-readiness");
    // The sandbox task is not also in Needs Attention.
    expect(view.summary.needs_attention + view.summary.sandbox_count).toBe(2);
  });

  it("keeps every table row reachable from the totals", () => {
    const rows = view.agents.flatMap((agent) => agent.tasks);
    expect(rows).toHaveLength(view.summary.task_count);
  });
});

describe("agent summaries", () => {
  const view = buildScreen1View();

  it("describes each agent by how its tasks are doing", () => {
    const summaries = Object.fromEntries(view.agents.map((agent) => [agent.name, agent.summary]));
    expect(summaries["Invoice Helper"]).toBe("4 tasks · 4 healthy");
    expect(summaries["Tax Helper"]).toBe("4 tasks · 2 healthy · 1 paused · 1 in sandbox");
  });

  it("never gives an agent an autonomy level of its own", () => {
    for (const agent of view.agents) {
      expect(Object.keys(agent)).not.toContain("level");
      expect(Object.keys(agent)).not.toContain("autonomy_level");
      expect(agent.summary).not.toMatch(/\bL[1-4]\b/);
    }
  });
});

describe("operational state and recommendation are separate", () => {
  const view = buildScreen1View();
  const rows = Object.fromEntries(
    view.agents.flatMap((agent) => agent.tasks).map((task) => [task.task_id, task]),
  );

  it("matches the agreed state and signal for every task", () => {
    const expected: Record<string, [string, string | null]> = {
      "read-invoice-fields": ["Healthy", null],
      "classify-expense": ["Healthy", null],
      "match-invoice-to-ledger": ["Healthy", "Eligible for promotion"],
      "detect-invoice-exceptions": ["Healthy", "Eligible for promotion"],
      "routine-rule-application": ["Healthy", "Remain Supervised"],
      "risk-detection": ["Healthy", "Eligible for promotion"],
      "draft-tax-position": ["Paused", "Rule-version mismatch"],
      "filing-readiness": ["Sandbox", "Revalidation in progress"],
    };
    for (const [taskId, [state, signal]] of Object.entries(expected)) {
      expect(rows[taskId]?.state_label, taskId).toBe(state);
      expect(rows[taskId]?.signal, taskId).toBe(signal);
    }
  });

  it("keeps promotion-ready tasks Healthy rather than flagging them", () => {
    const eligible = Object.values(rows).filter(
      (row) => row.signal === "Eligible for promotion",
    );
    expect(eligible).toHaveLength(3);
    for (const row of eligible) {
      expect(row.state).toBe("healthy");
    }
  });

  it("shows the same agent holding four different autonomy levels", () => {
    const invoice = view.agents.find((agent) => agent.name === "Invoice Helper");
    const levels = invoice?.tasks.map((task) => task.level_label) ?? [];
    expect(new Set(levels).size).toBeGreaterThan(1);
  });
});

describe("filters", () => {
  it("parses only the filters the screen offers", () => {
    expect(parseTaskFilter(undefined)).toBe("all");
    expect(parseTaskFilter("attention")).toBe("attention");
    expect(parseTaskFilter("sandbox")).toBe("sandbox");
    expect(parseTaskFilter("nonsense")).toBe("all");
    expect(parseTaskFilter(["sandbox", "attention"])).toBe("sandbox");
  });

  it("narrows to the paused task", () => {
    const view = buildScreen1View("attention");
    const rows = view.agents.flatMap((agent) => agent.tasks);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.task_id).toBe("draft-tax-position");
  });

  it("narrows to the task under revalidation", () => {
    const view = buildScreen1View("sandbox");
    const rows = view.agents.flatMap((agent) => agent.tasks);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.task_id).toBe("filing-readiness");
  });

  it("drops agents with no matching tasks instead of showing empty cards", () => {
    const view = buildScreen1View("sandbox");
    expect(view.agents).toHaveLength(1);
    expect(view.agents[0]?.name).toBe("Tax Helper");
  });

  it("keeps the agent summary describing all its tasks, not just the filtered ones", () => {
    const view = buildScreen1View("sandbox");
    expect(view.agents[0]?.tasks).toHaveLength(1);
    // A filtered view must not make Tax Helper look like a one-task agent.
    expect(view.agents[0]?.summary).toBe("4 tasks · 2 healthy · 1 paused · 1 in sandbox");
  });

  it("leaves the headline totals unfiltered", () => {
    const view = buildScreen1View("sandbox");
    expect(view.summary.task_count).toBe(8);
    expect(view.filter_counts.all).toBe(8);
  });
});

describe("alerts and sandbox teaser", () => {
  const view = buildScreen1View();

  it("raises one alert, from the open blocking incident", () => {
    expect(view.alerts).toHaveLength(1);
    expect(view.alerts[0]?.task_name).toBe("Draft tax position");
    expect(view.alerts[0]?.headline).toBe("Evaluation paused");
  });

  it("shows the previously approved level beside the level the candidate restarts from", () => {
    expect(view.sandbox?.task_name).toBe("Filing readiness");
    expect(view.sandbox?.previous_level_label).toBe("L4 · Constrained");
    expect(view.sandbox?.candidate_level_label).toBe("L1 · Shadow");
  });

  it("derives validation progress from the record", () => {
    expect(view.sandbox?.evaluated).toBe(142);
    expect(view.sandbox?.planned).toBe(200);
    expect(view.sandbox?.percent).toBe(71);
  });
});
