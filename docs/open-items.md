# Open items

**V1 is complete.** Live at <https://autonomy-gate.vercel.app>, committed on
`main`, 447 tests, typecheck clean, production build green.

Nothing below blocks release. This file records genuinely optional work, accepted
deviations, and deliberate design calls.

Last updated: end of Phase 12, after live-site validation.

---

## 1. Optional post-MVP enhancements

None of these is required. The public prototype works honestly and completely
without either credential, and the About panel says which parts are seeded.

### 1.1 Live bounded classification

`@typesafe-ai/sdk@0.6.0` is installed and `TypeSafeJevProvider` sits behind the
unchanged `JudgmentProvider` interface. Setting `TYPESAFE_API_KEY` in the Vercel
project switches to it; nothing above the provider changes.

Verified both ways: with a credential the real provider is used and fails closed
to `uncertain` when the key is rejected; without one the seeded provider answers
and the disclosure reflects it.

### 1.2 Live plain-language summaries

Setting `GROQ_API_KEY` switches the wording from the deterministic template to a
rephrasing of the same decision. `GROQ_MODEL` overrides the default small model.

A test asserts every autonomy outcome is identical with the layer removed, so
this changes presentation only.

### 1.3 Other genuinely optional work

- Push to GitHub so the code is readable alongside the demo.
- A custom domain in place of the `vercel.app` address.
- Light theme. The approved reference screens are dark-only and so is the build.

---

## 2. Accepted deviations

Each was raised, decided, and is closed.

### 2.1 Dataset is 1,444 runs, not the PRD's 800-1,000

Forced arithmetic: the four demo journeys require 342 + 300 + 200 + 200 = 1,042
runs by policy before the other four tasks exist. No pre-window evidence is
generated and the four non-journey tasks total 354 runs. Bundled, deterministic,
36 KB gzipped. **Accepted.**

### 2.2 Three figures differ from the earlier placeholder snapshot

Not reachable as integers at n=342:

| Figure | Placeholder | Actual | Why |
|---|---:|---:|---|
| Accuracy | 98.6% | 98.5% | 337/342 = 98.54%, 338/342 = 98.83% |
| Confident-but-wrong | 0.7% | 0.88% | 2/342 = 0.58%, 3/342 = 0.88% |
| Sampled error rate | 0.8% | 0.0% | 41 sampled; 0 gives 0%, 1 gives 2.4% |

Gating behaviour is identical: one failing criterion, and it is
confident-but-wrong. **Accepted - the generated values stand.**

### 2.3 Tailwind 3.4 rather than 4.x

The approved screens are a v3 config, extracted programmatically into
`design/tokens.json`. **Accepted.**

### 2.4 No `AGENT_ID` chip on Screen 1

Those identifiers do not exist in the data model, and decorative technical IDs
conflict with PRD section 3.10. **Accepted - not restored.**

### 2.5 Confirming the classification as critical yields `RESTRICT_SCOPE`

The error sits in Complex AU while the routine segments stay clean, so the engine
argues for a narrower fence rather than stopping the task outright. This is the
section 24.5 behaviour. **Accepted.**

### 2.6 Brief flash before a visitor's changes apply

Pages are prerendered from the seeded state; a visitor's changes live in their
browser. About a tenth of a second, after which a banner explains what changed.
**Accepted.**

---

## 3. Deliberate design calls

### 3.1 Not applicable never excuses a mandatory requirement

Two different reasons a criterion can be unmeasurable, and they behave
differently:

- **No opportunity to observe.** No case in the window called for escalation, so
  escalation quality could not be judged either way. Reported as *Not
  applicable*, and does not block. This is the only such criterion.
- **Mandatory, evidence absent.** A policy requiring 10% of completed cases be
  sampled is not satisfied by sampling none of them. Required sampling, sampled
  error rate and override rate all **fail** when unmeasurable, and block.

Minimum stage evidence, rule alignment and evidence coverage are counted directly
and are always measurable.

### 3.2 Scope restriction while blocked

Narrowing scope stays available to a person whenever promotion is blocked,
because reducing exposure is conservative.

But where evaluation is paused because the evidence itself cannot be trusted - a
rule-version mismatch, an unrevalidated configuration, an open blocking issue -
the product proposes **no segments of its own**. Deriving a fence from the
evaluation it has just declared untrustworthy would be incoherent. The option is
offered with the existing scope, and the narrower boundary is the reviewer's to
choose. Promotion remains unavailable either way.

### 3.3 Evaluator-maturity rate measured but non-gating

`unresolved_classification_rate` is computed and exposed on the metrics. PRD
section 12.4 says the 10% guardrail "does not directly change autonomy unless
encoded in policy", and the prototype policies deliberately do not encode it. The
hook is in place. **Accepted for V1.**

---

## 4. Resolved during the build

- **Mandatory criteria could become non-blocking N/A** (Phase 12). Sample
  coverage, sampled error rate and override rate all silently stopped blocking
  when unmeasurable. Fixed; only escalation quality remains observation-dependent.
- **A fence was proposed from untrustworthy evidence** (Phase 12). Fixed.
- **Navigation unreachable on a phone** (Phase 12). Labels wrapped onto three
  lines and Audit Log was clipped with no way to reach it. The strip now scrolls.
- **Three incoherent bounded classifications** (Phase 2). Confirmed critical and
  material errors were attached to runs the agent got right. Retargeted, with
  three seed invariants to prevent recurrence.
- **Stale-HMR error** (Phase 5). Investigated rather than assumed; a dev-server
  artifact, not a defect.
- **`next lint` removed in Next 16** (Phase 3). Replaced with the ESLint CLI.
- **Scope table could not explain its own verdicts** (Phase 4). Two segments
  shared an accuracy and differed in verdict because the verdict turns on
  confident-but-wrong, which was not a column. Added.
- **Three of six comprehension questions unanswerable** (Phase 5.5). Fixed in
  copy and hierarchy; see `docs/comprehension-checkpoint.md`.
- **Revalidation rendered as an arrow to itself** (Phase 6).
- **Publishing a policy version created no audit event** (Phase 7).
