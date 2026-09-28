# Open items

**V1 is complete and publicly shareable.** Live at
<https://autonomy-gate.vercel.app>, committed on `main`, 447 tests, typecheck
clean, production build green.

Last updated: 2026-09-29, after the TypeSafe live integration and the
review-readiness pass.

Nothing in section 1 blocks release. Sections 2 and 3 are closed and kept only so
the reasoning is not lost.

---

## 1. Genuinely open — all optional

### 1.1 Live plain-language summaries (Groq) — not configured

Setting `GROQ_API_KEY` in the Vercel project switches the wording of an
already-final decision from the deterministic template to a rephrasing of it.
`GROQ_MODEL` overrides the default small model.

Without it the product shows the **Standard summary**, and the About panel says
so. A test asserts every autonomy outcome is identical with the layer removed, so
this changes presentation only and can never change a decision.

**Optional post-MVP. Not required for public sharing.**

### 1.2 Other optional work

- Push to GitHub so the code is readable alongside the demo. The engine-purity
  test is the most interesting artefact in the repository and currently nobody
  can see it.
- A custom domain in place of the `vercel.app` address.
- Light theme. The approved reference screens are dark-only and so is the build.

### 1.3 Known consequence of the live integration

Every visitor who clicks **Classify the note again** spends TypeSafe quota. A
rate-limited or failed call degrades to *"This case needs human review"*, which
is correct behaviour and leaves autonomy untouched — but it is less impressive
than the live path during a demo. Removing `TYPESAFE_API_KEY` from the Vercel
project reverts to seeded responses at any time, and the About panel updates
itself. **No action needed; noted so the trade-off is a choice rather than a
surprise.**

---

## 2. Completed

### 2.1 Live bounded classification (TypeSafe) — **integration completed 2026-09-29**

`TYPESAFE_API_KEY` is set in the Vercel project as a hidden secret, production
scope only. `TypeSafeJevProvider` sits behind the unchanged `JudgmentProvider`
interface; nothing above the provider changed to enable it.

Verified on the live site:

| Check | Result |
|---|---|
| Real service in use | `/api/judgment` returns `live: true`, `source: "live"` |
| Not a fixed value | Confidence varied 0.91 / 0.90 / 0.88 across three calls; the classification stayed `material_error` |
| Disclosure is truthful | About panel reads *"Currently produced by a live external service"* |
| Groq correctly absent | Same panel reads *"written from fixed templates"*; scorecards show **Standard summary** |
| No credential exposure | 9 client bundles, inline scripts and full page HTML all clean; the key is a hidden Vercel secret and appears in no response |
| Fails safe | A rejected key returns `uncertain` at confidence 0 → *"This case needs human review"*; the task stayed **L3 · Supervised / Eligible / Remain Supervised** with criteria still assessed |
| Bounded either way | The answer is narrowed against our own vocabulary at runtime, so an unrecognised label becomes `uncertain` rather than evidence |

The credential is held in `.env.local` locally (gitignored) and in Vercel for
production. `.env.example` carries a blank placeholder and is the only env file
tracked by git.

### 2.2 Review-readiness cleanup — completed 2026-09-29

Five clarity and correctness defects found by reviewing the product as a
first-time visitor, all fixed and verified live:

- The Sandbox continuity button was disabled with no explanation of what was
  missing. It now names each outstanding requirement, and the reason field shows
  a character count. Same treatment applied to the autonomy decision form.
- The reason-category chips on both forms had no label. Now labelled
  **Category (optional)**, and exposed as a labelled group to screen readers.
- **Confirm as …** recorded a hardcoded `material_error` regardless of its own
  label. It now records the classification the view actually holds. Harmless with
  the current seed, wrong for any other.
- A vestigial `aligned ? "on" : "on"` ternary on the configuration panel.
- **Reset demo** counted only decisions, so changing a classification showed
  *"Reset demo (0)"* and *"Discard 0 recorded decisions?"* with real work to
  undo. It now counts every kind of change.

---

## 3. Accepted deviations and deliberate design calls

Each was raised, decided and closed. Full evidence in
[`acceptance-matrix.md`](acceptance-matrix.md).

- **Dataset is 1,444 runs, not the PRD's 800–1,000.** The four demo journeys
  require 1,042 runs by policy before the other four tasks exist. 36 KB gzipped.
- **Three figures differ from the earlier placeholder snapshot** — accuracy
  98.5% not 98.6%, confident-but-wrong 0.88% not 0.7%, sampled error 0.0% not
  0.8%. None is reachable as an integer count at n=342. Gating behaviour is
  identical.
- **Tailwind 3.4 rather than 4.x**, for byte-exact parity with the approved v3
  mockup config.
- **No `AGENT_ID` chip on Screen 1.** Those identifiers do not exist in the data
  model, and decorative technical IDs conflict with PRD §3.10.
- **Confirming a critical classification yields `RESTRICT_SCOPE`,** not a full
  stop: the error sits in Complex AU while the routine segments stay clean.
- **Brief flash before a visitor's changes apply.** Pages are prerendered from the
  seeded state; a banner then explains what changed.
- **Not applicable never excuses a mandatory requirement.** Required sampling,
  sampled error rate and override rate *fail* when unmeasurable. Only escalation
  quality, where the window offered no opportunity to observe, is reported as not
  applicable and does not block.
- **No evidence-based scope fence is derived from untrustworthy evidence.**
  Narrowing stays available to a person; the product proposes no segments of its
  own.
- **Evaluator-maturity rate measured but non-gating.** PRD §12.4 says the 10%
  guardrail does not change autonomy unless encoded in policy, and the prototype
  policies deliberately do not encode it.
