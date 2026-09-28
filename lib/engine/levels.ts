import { AUTONOMY_ORDER, type AutonomyLevel, type StageKey } from "@/lib/domain/types";

/**
 * Level arithmetic. Progression is one level at a time and never above a task's
 * ceiling; both are structural rules rather than recommendations, so they live
 * here and every caller goes through them.
 */

export function levelIndex(level: AutonomyLevel): number {
  return AUTONOMY_ORDER.indexOf(level);
}

/** The single level above `current`, or null at the top of the scale. */
export function nextLevel(current: AutonomyLevel): AutonomyLevel | null {
  return AUTONOMY_ORDER[levelIndex(current) + 1] ?? null;
}

/** The single level below `current`, or null at the bottom of the scale. */
export function previousLevel(current: AutonomyLevel): AutonomyLevel | null {
  const index = levelIndex(current);
  return index <= 0 ? null : (AUTONOMY_ORDER[index - 1] ?? null);
}

/** The next level a task may actually target, accounting for its ceiling. */
export function targetLevel(
  current: AutonomyLevel,
  ceiling: AutonomyLevel,
): AutonomyLevel | null {
  const next = nextLevel(current);
  if (next === null) return null;
  return levelIndex(next) > levelIndex(ceiling) ? null : next;
}

export function isAtCeiling(current: AutonomyLevel, ceiling: AutonomyLevel): boolean {
  return levelIndex(current) >= levelIndex(ceiling);
}

/**
 * The stage a task is trying to leave. This is what makes later-stage evidence
 * requirements structural: the stage determines both which criteria apply and
 * which mode's runs are admissible.
 */
export function stageFor(current: AutonomyLevel): StageKey | null {
  switch (current) {
    case "shadow":
      return "shadow_to_assisted";
    case "assisted":
      return "assisted_to_supervised";
    case "supervised":
      return "supervised_to_constrained";
    case "constrained":
      return null;
  }
}

/**
 * Whether a human may record `target` as the new level for a task currently at
 * `current`. A human may disagree with the recommendation; they may not skip a
 * level or exceed the ceiling, because those are the product's structural rules
 * rather than the engine's opinion.
 */
export function isStructurallyPermittedLevel(
  current: AutonomyLevel,
  target: AutonomyLevel,
  ceiling: AutonomyLevel,
): boolean {
  if (levelIndex(target) > levelIndex(ceiling)) return false;
  const distance = levelIndex(target) - levelIndex(current);
  // Same level, one step up, or one step down. Never a jump.
  return distance >= -1 && distance <= 1;
}
