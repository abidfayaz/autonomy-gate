# MVP acceptance criteria

Every criterion from PRD §30, checked against the live deployment at
<https://autonomy-gate.vercel.app> and against the test suite.

**Verified:** 2026-09-28 against the deployed application, not only the test
suite · 447 tests · typecheck clean · production build green.

## Task-level autonomy

| Criterion | Evidence |
|---|---|
| Whole agent never receives a single autonomy level | No entity in the data model carries one. The agent card has nowhere to put it. Asserted by test over the rendered DOM. |
| Each task stores its own autonomy | Eight tasks, four distinct levels. Live: Invoice Helper holds L4, L3, L3, L2 across its four tasks. |
| Each task has an autonomy ceiling | Draft tax position is capped at Supervised; no promotion to Constrained is offered at any point. |
| Promotion happens one level at a time | L2 to L4 is rejected regardless of evidence. 900 flawless Shadow cases still recommend only Assisted. |

## Stage-specific evaluation

| Criterion | Evidence |
|---|---|
| Shadow to Assisted uses Shadow evidence | Risk detection: accuracy, confident-but-wrong, coverage. No override or sampling criteria appear. |
| Assisted to Supervised requires Assisted-mode evidence | Detect invoice exceptions: override rate and correct escalation. No sampling criteria. |
| Supervised to Constrained requires Supervised-mode evidence | Match invoice to ledger: eight criteria including post-execution sampling, boundary violations, missed exceptions. |
| Re-running the original benchmark is not sufficient | A flawless 500-case Shadow benchmark fed to an Assisted task yields `valid_case_count: 0`. Evidence is admissible only from the stage's own mode. |

## Eligibility

| Criterion | Evidence |
|---|---|
| Eligibility evaluated before autonomy criteria | Section order on the scorecard, asserted by test. |
| Failed eligibility blocks progression assessment | Classify expense, Draft tax position and Filing readiness render no criteria table at all. |
| Rule mismatch pauses affected scope | Draft tax position: task v2.4, evaluator v2.3, current v2.4 → paused, criteria not assessed, per-segment verdicts withheld. |

## Human governance

| Criterion | Evidence |
|---|---|
| Final promotion requires human approval | The engine only ever recommends. Nothing changes level without a recorded decision. |
| Scope restriction requires human approval | Offered as a decision option; never applied automatically. |
| Rollback requires human approval | `ROLLBACK_RECOMMENDED` is a recommendation. The seeded record shows one declined, level retained. |
| Sandbox continuity requires human approval | Three continuity options, none applied by default. |
| Human reason is stored | Mandatory, minimum ten characters, kept with the decision and shown in the audit drawer. |

Also enforced, beyond the PRD's list: an override may disagree with a
recommendation but may not skip a level, exceed a ceiling, or approve a
promotion on evidence the evaluation has already found untrustworthy.

## Sandbox

| Criterion | Evidence |
|---|---|
| Material change triggers revalidation | Filing readiness, after `filing-readiness-rules` v3.1 to v3.2. |
| Candidate begins in Shadow | Live: previous L4 · Constrained beside candidate L1 · Shadow. |
| Previous autonomy visible but not inherited | Stated on screen: "Kept as a record, not as an entitlement." |
| Human records continuity outcome | Three distinct options, mandatory reason, recorded to the audit log as a revalidation. |
| No automatic task-splitting suggestion exists | Asserted by test across the whole screen. |

## Policies

| Criterion | Evidence |
|---|---|
| Thresholds are editable | Three stage minimums plus six thresholds. |
| Saving creates a new policy version | v1.3 to v1.4, with the change noted and a warning before saving. |
| Historical decisions retain historical policy versions | After publishing v1.4, the 2026-05-18 decision still reads v1.2. |

## Bounded judgment

| Criterion | Evidence |
|---|---|
| Used for at least one bounded classification | Error severity, complexity and evidence state, all closed vocabularies. |
| Consequential classifications can require human confirmation | Tax Helper: critical, material, uncertain. Invoice Helper: critical, uncertain. |
| Uncertain or unavailable routes to human | Every failure path returns `uncertain`. Verified live: a rejected credential returns `uncertain`, confidence 0. |
| Never directly changes autonomy | A classification enters the gate only once confirmed, and only as an input. |

## Explanation layer

| Criterion | Evidence |
|---|---|
| Explains structured decisions | Receives a reason code and the quoted figures. Never the evidence. |
| Outage does not block the product | Four failure modes tested. The deterministic wording is produced first and always renders. |
| Does not decide autonomy | Engine outcomes compared against rendered outcomes for all eight tasks: identical. |

## Audit

| Criterion | Evidence |
|---|---|
| Decisions show who, what, why, scope, policy and rule version | Every drawer field, asserted against the source decision. |
| Historical decisions are not recalculated | The 2026-05-18 record still reads 240 Assisted-mode cases under policy v1.2 and rule v3.1, while the same task today reports 342 Supervised-mode cases under v1.3 and v3.2. |

## Unmeasurable criteria

| Criterion | Evidence |
|---|---|
| Not applicable never excuses a mandatory requirement | Required sampling, sampled error rate and override rate all **fail** when their evidence is absent, and block. Only escalation quality, where the window offered no opportunity to observe, is reported as not applicable and does not block. |
| Minimum stage evidence, rule alignment and evidence coverage are always measurable | Counted directly from records; they cannot become not applicable. |

## Scope restriction while blocked

| Criterion | Evidence |
|---|---|
| A person may narrow scope even while promotion is blocked | Offered on every blocked task; reducing exposure is conservative. |
| No evidence-based scope recommendation is derived from untrustworthy evidence | Live on Draft tax position: *"The current evaluation cannot be trusted, so no segments are proposed: the narrower scope is yours to choose."* All four per-segment verdicts read *Not assessed*. |
| Promotion remains unavailable | No approve option is offered, and `isRecordableDecision` rejects one regardless of the interface. |

## Non-goals, confirmed absent

No whole-agent autonomy. No automatic rollback. No automatic continuity. No
automatic task splitting. No autonomous policy change. No model-driven autonomy
decision. No real tax logic, customer data, filings or ledger entries.
