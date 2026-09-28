"use client";

import { useMemo } from "react";
import { Icon } from "@/components/Icon";
import { ClassificationPanel } from "@/components/screen2/ClassificationPanel";
import {
  ConfigurationSection,
  CriteriaSection,
  EligibilitySection,
  HeadlineCards,
  NextLevelFooter,
  ScopeSection,
} from "@/components/screen2/Sections";
import type { AutonomyLevel, PolicyVersion, Task } from "@/lib/domain/types";
import { evaluateFromEvidence } from "@/lib/engine";
import {
  classificationsForTask,
  effectiveLevel,
  effectiveMaterialChangePending,
  effectivePolicy,
  hasConfirmedCritical,
  latestDecisionFor,
  policyEditsFor,
} from "@/lib/state/demoState";
import { useDemoState } from "@/lib/state/DemoStateProvider";
import type { TaskEvidence } from "@/lib/view/policies";
import { scorecardFromResult, type ScorecardMeta, type ScorecardView } from "@/lib/view/taskScorecard";

/**
 * Renders the scorecard for the level and policy this visitor's changes leave in
 * force.
 *
 * With nothing changed it shows the variant the server prepared. Once a policy
 * has been edited, the same engine re-runs here against evidence already reduced
 * to counts, so the evidence itself never crosses into the browser and the
 * outcome is the one the engine would have produced on the server.
 */
export function ScorecardClient({
  variants,
  seededLevel,
  taskId,
  task,
  meta,
  seededPolicy,
  evidence,
  evidenceIfCritical,
  currentRuleVersion,
}: {
  variants: Partial<Record<AutonomyLevel, ScorecardView>>;
  seededLevel: AutonomyLevel;
  taskId: string;
  task: Task;
  meta: ScorecardMeta;
  seededPolicy: PolicyVersion;
  evidence: Partial<Record<AutonomyLevel, TaskEvidence>>;
  evidenceIfCritical: Partial<Record<AutonomyLevel, TaskEvidence>>;
  currentRuleVersion: string;
}) {
  const { state } = useDemoState();
  const level = effectiveLevel(state, taskId, seededLevel);
  const decision = latestDecisionFor(state, taskId);
  const policyEdited = policyEditsFor(state, taskId).length > 0;
  const policy = effectivePolicy(state, seededPolicy);
  // Resolving a revalidation removes the conditional eligibility check, so the
  // scorecard has to be recomputed rather than read from a prepared variant.
  const materialChangePending = effectiveMaterialChangePending(
    state,
    taskId,
    task.material_change_pending,
  );
  const revalidationResolved = task.material_change_pending && !materialChangePending;
  // A confirmed critical classification is the one human resolution that changes
  // what the gate computes, so it selects a different precomputed evidence set.
  const criticalConfirmed = hasConfirmedCritical(state, taskId);
  const classificationTouched = classificationsForTask(state, taskId).length > 0;

  const view = useMemo(() => {
    const prepared = variants[level] ?? variants[seededLevel];
    if (!policyEdited && !revalidationResolved && !classificationTouched) return prepared;

    const source = criticalConfirmed ? evidenceIfCritical : evidence;
    const levelEvidence = source[level];
    if (!levelEvidence) return prepared;

    const result = evaluateFromEvidence({
      task: { ...task, current_level: level, material_change_pending: materialChangePending },
      policy,
      currentRuleVersion,
      metrics: levelEvidence.metrics,
      segmentStats: levelEvidence.segmentStats,
      openIncidents: [],
    });
    return scorecardFromResult(result, meta, policy.version);
  }, [
    variants,
    level,
    seededLevel,
    policyEdited,
    revalidationResolved,
    materialChangePending,
    classificationTouched,
    criticalConfirmed,
    evidence,
    evidenceIfCritical,
    task,
    policy,
    currentRuleVersion,
    meta,
  ]);

  if (!view) return null;

  return (
    <>
      {decision ? (
        <div className="flex items-start gap-space-sm rounded-xl border border-secondary/40 bg-secondary/5 p-space-md">
          <Icon name="edit_note" className="text-secondary" />
          <p className="font-body-md text-body-md text-on-surface-variant">
            You recorded a decision for this task on {decision.decided_at}, moving it to{" "}
            {view.current_level_label}. The scorecard below reflects that decision. Use{" "}
            <span className="text-on-surface">Reset demo</span> to restore the original state.
          </p>
        </div>
      ) : null}

      {policyEdited ? (
        <div className="flex items-start gap-space-sm rounded-xl border border-secondary/40 bg-secondary/5 p-space-md">
          <Icon name="rule_folder" className="text-secondary" />
          <p className="font-body-md text-body-md text-on-surface-variant">
            You published policy v{policy.version} for this task. The criteria below are assessed
            against it. Decisions already recorded keep the version they were made under.
          </p>
        </div>
      ) : null}

      <HeadlineCards view={view} />
      <EligibilitySection view={view} />
      <CriteriaSection view={view} />
      <ScopeSection view={view} />
      <ClassificationPanel
        view={view.classification}
        taskId={taskId}
        judgmentId={meta.judgment_id}
        runId={meta.judgment_run_id}
      />
      <ConfigurationSection view={view} />
      <NextLevelFooter view={view} />
    </>
  );
}
