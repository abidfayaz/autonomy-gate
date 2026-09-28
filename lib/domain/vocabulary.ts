import type { AutonomyLevel, OperationalState } from "./types";

/**
 * The only vocabulary the governance UI is allowed to use, plus the terms it must
 * never use. Tests from Phase 3 onward assert rendered output against DENIED_TERMS,
 * so a forbidden word cannot reach a screen unnoticed.
 */

export const AUTONOMY_LABELS: Record<AutonomyLevel, { code: string; name: string; label: string }> =
  {
    shadow: { code: "L1", name: "Shadow", label: "L1 · Shadow" },
    assisted: { code: "L2", name: "Assisted", label: "L2 · Assisted" },
    supervised: { code: "L3", name: "Supervised", label: "L3 · Supervised" },
    constrained: { code: "L4", name: "Constrained", label: "L4 · Constrained" },
  };

/**
 * Level descriptions taken from the PRD rather than the reference screens: the
 * screens described Assisted as handling selected cases on its own, which is
 * Supervised behaviour. At Assisted a human approves before anything is operational.
 */
export const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  shadow: "AI performs the task for evaluation. Human work remains authoritative.",
  assisted: "AI recommends; a human approves before the result becomes operational.",
  supervised:
    "AI handles approved routine cases without pre-approval. Humans monitor exceptions and samples.",
  constrained: "AI works independently within clearly approved boundaries.",
};

export const OPERATIONAL_STATE_LABELS: Record<OperationalState, string> = {
  healthy: "Healthy",
  "needs-review": "Needs Review",
  sandbox: "Sandbox",
  paused: "Paused",
};

/** Recommendation vocabulary. Kept separate from operational state by design. */
export const RECOMMENDATION_LABELS = {
  ELIGIBLE_FOR_NEXT_LEVEL: "Eligible for promotion",
  REMAIN_AT_CURRENT_LEVEL: "Remain at current level",
  RESTRICT_SCOPE: "Restrict scope",
  LOWER_AUTONOMY_RECOMMENDED: "Lower autonomy recommended",
  ROLLBACK_RECOMMENDED: "Rollback recommended",
  EVALUATION_PAUSED: "Evaluation paused",
} as const;

/**
 * Terms that must never appear in the governance UI.
 * The first group is marketing overreach the PRD rules out; the second is
 * implementation detail that belongs in architecture docs, not in Maya's screens.
 */
export const DENIED_TERMS: readonly string[] = [
  // Overclaiming
  "full autonomy",
  "fully trusted",
  "autonomous agent",
  "verified autonomous",
  "gate integrity",
  "attestation",
  "immutable ledger",
  "cryptographic verification",
  "deterministic runtime",
  "evidence quorum",
  "trust score",
  // Implementation detail
  "Jev",
  "Groq",
  "LLM",
  "TypeSafe",
  "inference",
  "embeddings",
  "deterministic engine",
  "model hash",
  "checksum",
  "policy digest",
  "SHA256",
];

/** How the product expresses that history is preserved, without forbidden terms. */
export const HISTORY_PRESERVED_NOTICE =
  "Historical decisions keep the policy version used at the time.";
