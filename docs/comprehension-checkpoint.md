# Comprehension checkpoint (Phase 5.5)

A UX and content gate, not a feature phase. Someone unfamiliar with the product,
given only the Scorecard and the Decision screen, should be able to answer six
questions unaided.

Walked against three states: **promotion-eligible** (Match invoice to ledger),
**held on an unmet criterion** (Routine rule application) and **paused**
(Draft tax position).

## Findings

| # | Question | Before | After |
|---|---|---|---|
| 1 | What autonomy level is this task currently at? | Pass | Pass |
| 2 | Why is it at that level? | **Fail** | Fixed (A) |
| 3 | What is preventing it from progressing? | Partial | Fixed (B) |
| 4 | What is the system recommending? | Pass | Pass |
| 5 | What can the human reviewer actually decide? | Pass | Pass, copy fixed (E) |
| 6 | What happens if the recommendation is overridden? | **Fail** | Fixed (C) |

### Q2 — "Why is it at that level?" failed outright

Neither screen said how the task *arrived* at its current level. The scorecard
covered where it is and where it could go, but nothing about how it got there.
The Decision screen had a "Previous decision" block, but only for tasks with
seeded history, and only at the very bottom of the page.

A reader looking at "L3 · Supervised" had no way to learn that it was approved on
a particular date, by a person, on the strength of Assisted-mode evidence.

### Q6 — "What happens if overridden?" failed outright

Options were marked "Differs from recommendation" and overriding required an
acknowledgement plus a reason, so the reader learned what they had to *do*. But
nothing said what would *happen*: that the decision takes effect immediately,
that the system's recommendation is kept alongside it, and that the disagreement
stays visible in the audit history permanently.

The acknowledgement described the act rather than its consequence.

### Q3 — partial failure on the Decision screen

The scorecard was clear. On the Decision screen, the "Decision basis" criteria
list distinguished the failing criterion by **colour alone**: in plain text,
`Confident-but-wrong rate 0.88% vs ≤ 0.25%` reads exactly like the seven rows
that passed. A screen-reader user, or anyone scanning, could not tell which
criterion blocked the promotion. The eligibility list beside it did say "Pass"
and "Not met", so the two halves of the same panel disagreed on how to report a
result.

## Also fixed

- **Hierarchy.** "Not included in this decision" ran two different kinds of
  thing into one flat list: excluded case scopes (Complex cases, Cross-border
  cases) and the agent's other tasks (Read invoice fields, Classify expense).
  A reader could easily take "Read invoice fields" for a case type. Now split
  into two labelled groups.
- **Copy.** Keeping the level on a *paused* task read "while more evidence is
  collected". Evidence is not the problem there; the rule versions are. Now
  context-sensitive.
- **Copy.** "308 of 300 required cases" scanned as a shortfall on first read.
  Now "308 cases evaluated. 300 required at this stage."

## Fixes applied

| | Change | Where |
|---|---|---|
| A | Current autonomy states when and how the level was approved, and who by | Scorecard, Decision screen |
| B | Criteria rows carry explicit Pass / Not met, matching the eligibility rows | Decision screen |
| C | Override acknowledgement states the consequence, not the act | Decision screen |
| D | Excluded scope and unaffected sibling tasks split into two groups | Decision screen |
| E | "Keep current level" description adapts when evaluation is blocked | Decision screen |
| F | Case-count phrasing reads as a count, not a shortfall | Scorecard, Decision screen |

No architecture terminology was introduced: every fix is wording, hierarchy or
labelling. No new capability, and no settled decision reopened.
