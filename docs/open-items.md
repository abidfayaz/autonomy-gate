# Open items

Things deliberately left, deferred, or awaiting a decision. None of these block
the build; each names who or what unblocks it.

Last updated: end of Phase 11.

---

## 1. Blocked on you

### 1.1 Public Vercel URL — not yet live

**Raised:** Phase 3. **Still open.**

The Vercel CLI is installed but logged out, and I do not authenticate on your
behalf. Everything else is ready: zero-config, no `vercel.json`, no environment
variables needed.

```bash
npx vercel login
npx vercel --prod
```

This is the only unmet acceptance criterion from Phase 3.

### 1.2 Nothing is committed

**Raised:** Phase 3. **Still open.**

The repository is initialised and everything is staged, but there are no commits;
I only commit when asked. Needed before connecting Vercel to GitHub rather than
uploading through the CLI.

### 1.3 TypeSafe API key

**Built in Phase 11, unused until a key exists.** `@typesafe-ai/sdk@0.6.0` is
installed and the adapter sits behind the unchanged interface. Verified live: with
a key the provider is used and fails closed to `uncertain` when the key is
rejected; without one the mock answers and the About panel says so.
Details: `docs/typesafe-adapter-notes.md`.

### 1.4 Groq API key

**Built in Phase 10, unused until a key exists.** Absent, the deterministic
"Standard summary" is shown and labelled as such. No autonomy outcome depends on
it either way, which is asserted by test. `GROQ_MODEL` overrides the default
small model if the named one is unavailable.

---

## 2. Known deviations, accepted

### 2.1 Dataset is 1,444 runs, not the PRD's 800–1,000

**Phase 1.** Forced arithmetic: the four approved demo journeys require
342 + 300 + 200 + 200 = 1,042 runs by policy before the other four tasks exist.
No historical pre-window evidence is generated, and the four non-journey tasks
total only 354 runs. Bundled and deterministic; 36 KB gzipped.

### 2.2 Three figures differ from the locked snapshot

**Phase 1.** Not reachable as integers at n=342:

| Figure | Specified | Actual | Why |
|---|---:|---:|---|
| Accuracy | 98.6% | 98.5% | 337/342 = 98.54%, 338/342 = 98.83% |
| Confident-but-wrong | 0.7% | 0.88% | 2/342 = 0.58%, 3/342 = 0.88% |
| Sampled error rate | 0.8% | 0.0% | 41 sampled; 0 → 0%, 1 → 2.4% |

Gating behaviour is identical: one failing criterion, and it is
confident-but-wrong. Moving the count to ~429 would hit 0.7% exactly, if you
would rather have the stated figure than the stated count.

### 2.3 Tailwind 3.4 rather than 4.x

**Phase 0.** The approved screens are a Tailwind v3 config, extracted
programmatically into `design/tokens.json`. v4 would require re-deriving nine
`fontSize` triples by hand and overriding `rounded-full`, which v4 hardcodes to
`calc(infinity * 1px)` while the mockups define it as `0.75rem`. Reversible.

### 2.4 `AGENT_ID` chip dropped from Screen 1

**Phase 3.** The mockups show `AGENT_ID: AGT-INV-004`. Those identifiers do not
exist in the data model, and inventing decorative technical IDs conflicts with
PRD §3.10. Easy to restore if you want the visual detail.

### 2.5 Confirming the classification as critical reads `RESTRICT_SCOPE`

**Confirmed in Phase 9, in the browser.** Settling the outstanding classification
as critical blocks eligibility and recomputes immediately, as agreed. Because the
error sits in Complex AU while the routine segments stay clean, the engine argues
for a narrower fence rather than stopping the task outright.

**Phase 2, verified by test.** Confirming the pending classification as
`critical_error` does block eligibility and does recompute immediately, as
agreed. But the error sits in Complex AU while the routine segments stay clean,
so the engine argues for a narrower fence rather than stopping the task. This is
the §24.5 behaviour and reads as the better demonstration. Say the word if you
want the blanket block instead.

---

## 3. Deliberate design calls worth a second opinion

### 3.1 A not-applicable criterion does not block

**Phase 2.** Where a window contained no opportunity to measure something — no
escalation cases, for instance — the criterion shows **Not applicable** rather
than **Pass**, and does not block promotion. Showing a green Pass for an
untested requirement would be worse; blocking on a requirement that had no
chance to be tested would also be wrong. Reported honestly, non-blocking.

### 3.2 Scope restriction is always available

**Phase 5.** Narrowing the fence reduces exposure, so it is offered even while
evaluation is blocked. Only promotion is gated by eligibility.

### 3.3 Brief flash before a visitor's changes apply

**Phase 7.** Pages are server-rendered or prerendered from the seeded state, and
a visitor's decisions and policy versions live in their browser. So there is a
short moment after load where the seeded scorecard shows before the client
re-renders with their changes applied. Roughly a tenth of a second, and the
banner then explains what changed. Removing it entirely would mean giving up
static rendering or moving visitor state to a server, neither of which is worth
it for a prototype.

### 3.4 Evaluator-maturity guardrail is computed but not enforced

**Phase 2.** `unresolved_classification_rate` is computed and exposed on the
metrics. PRD §12.4 says the 10% guardrail "does not directly change autonomy
unless encoded in policy", and the prototype policies deliberately do not encode
it. The hook is in place if you want it to gate.

---

## 4. Carried into later phases

| Item | Lands in |
|---|---|






| Comprehension checkpoint | Done — see `docs/comprehension-checkpoint.md` |

---

## 5. Resolved

- **Stale-HMR error `BLOCKING_PHRASES is not defined`** (Phase 5). Seen in the
  browser console after editing files while the dev server was running.
  Investigated rather than assumed: the constant is defined and used correctly,
  and a clean restart produces no error. A dev-server artifact, not a defect.
- **Three incoherent bounded classifications** (Phase 2). Confirmed critical and
  material errors were attached to runs the agent got *right*, and one asserted a
  second unrelated critical error. All retargeted; three seed invariants now make
  the class of error impossible to reintroduce silently.
- **`next lint` removed in Next 16** (Phase 3). The Phase 0 script was broken;
  replaced with the ESLint CLI.
- **Scope table could not explain its own verdicts** (Phase 4). Two segments
  shared an accuracy and differed in verdict, because the verdict turns on
  confident-but-wrong, which was not a column. Added.
