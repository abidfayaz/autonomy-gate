# Implementation plan — amendments

The approved progressive implementation plan stands. These are the only changes,
all from the readiness review and the approved adjustments A–D.

## A. TypeSafe feasibility — no interface change

Spike complete. `JudgmentProvider` with `classifyError()`, `classifyComplexity()` and
`evaluateEvidenceState()` is viable against `@typesafe-ai/sdk@0.6.0` as planned.
Details and adapter constraints: `docs/typesafe-adapter-notes.md`.

One constraint moves **earlier** than Phase 11, because it belongs to the phase that writes
the route rather than the phase that swaps the provider:

> **Phase 9 addition.** `app/api/judgment/route.ts` pins `export const runtime = "nodejs"`
> and never sets `dangerouslyAllowBrowser`.

## B. New Phase 5.5 — comprehension checkpoint

Inserted after Phase 5, before Phase 6. Not a feature phase; a UX and content gate.

**Goal.** Someone unfamiliar with the product, given only the Scorecard and Decision screens,
can answer all six questions unaided:

1. What autonomy level is this task currently at?
2. Why is it at that level?
3. What is preventing it from progressing?
4. What is the system recommending?
5. What can the human reviewer actually decide?
6. What happens if the recommendation is overridden?

**Method.** Walk the two screens for a promotion-eligible task, a blocked task and a paused
task, and answer the six questions from the UI alone.

**Fixes allowed.** Terminology, information hierarchy, explanatory copy, labelling, ordering.

**Fixes not allowed.** Architecture terminology is never the remedy for a comprehension gap.
No new capability, no scope change, no reopening settled decisions.

**Acceptance.** All six answerable from the UI for all three task states, with no vocabulary
from the §21 deny-list and no implementation terms.

**Deferred as before:** everything from Phase 6 onward.

## C. Deploy milestone vs promotion milestone

Sequence unchanged.

- **Phase 3** — first public Vercel deployment. Technically public and shareable. Not promoted.
- **Phase 9** — first strong recruiter/demo milestone, once human decisions, auditability,
  policy versioning, sandbox revalidation and bounded judgment all exist. This is the version
  worth actively sharing.
- **Phase 12** — final content pass on top of that.

## D. Synthetic dataset discipline (Phase 1)

The 800–1,000-record reproducible dataset stays, because later screens and tests depend on it.
It is optimised for: determinism, cross-screen consistency, the eight demo journeys, the
required edge cases, and stage/policy logic.

It is **not** optimised for accounting realism. Vendor names, amounts and document details stay
minimal — just enough to be legible on screen. The dataset exists to validate the governance
system, not to simulate an accounting business.

## Phase 0 deviation on record

**Tailwind CSS 3.4 rather than 4.x.** The approved screens are a Tailwind v3 config, and the
token set was extracted from them programmatically (`design/tokens.json`, 47 colours, 4 radii,
9 spacing steps, 9 type sizes — verified identical across all six mockups, zero conflicts).
v3 consumes that config directly, so the six screens port with byte-exact token parity.
v4 would require re-deriving nine `fontSize` triples by hand and overriding `rounded-full`,
which v4 hardcodes to `calc(infinity * 1px)` while the approved screens define it as `0.75rem`
— the difference between pill badges and the slightly-rounded rectangles in the mockups.
Visual direction is a stated source of truth, so parity won over currency. Reversible later.
