# Demo script

**Live:** <https://autonomy-gate.vercel.app>

Nothing to install, nothing to sign in to. Anything you change is kept in your
own browser and **Reset demo** in the footer puts it back.

Two versions below: a **five-minute walkthrough** for a live conversation, and a
**one-minute version** for when someone is only half-listening.

---

## The one-minute version

> "A team has an AI agent doing eight different jobs. Saying *the agent is 98%
> accurate* tells you nothing about whether any one of those jobs is safe to
> loosen, because an average hides the parts it is bad at.
>
> Autonomy Gate evaluates each task separately, and each level of freedom has to be
> earned with a different kind of proof. Here" — *Agents & Tasks* — "the same
> agent holds four different levels at once. This one is paused because the
> rulebook moved and the checker didn't. And this one had earned the top level,
> then a rule changed, so it went back to square one and has to prove itself
> again.
>
> The system only ever recommends. A person decides, and has to say why."

---

## The five-minute walkthrough

### 1. The problem, in one screen · *Agents & Tasks*

Point at **Invoice Helper**: four tasks, holding **L4, L3, L3 and L2**.

> "One agent. Four jobs. Four different levels of freedom, because they earned
> different amounts. If you granted autonomy to the agent, you'd be granting it
> to the weakest thing it does."

Note the two flags: one task **Paused**, one in **Sandbox**. Note also that the
three tasks marked *Eligible for promotion* are still **Healthy** — being ready
for more freedom is a recommendation, not a problem.

### 2. What "earned" actually means · *Routine rule application → View scorecard*

The headline: **Remain Supervised**, and one sentence saying why.

Scroll to **Autonomy criteria**. Eight requirements, seven met, one not:

> "Confident-but-wrong: 0.88% against a limit of 0.25%. That's how often it was
> wrong *while being sure*. Everything else passes. That single number is why
> this task isn't moving."

Then point at **Additional metrics** below the table:

> "Accuracy is 98.5% — and it's deliberately *not* one of the criteria here.
> At this stage the question isn't whether it's usually right. It's what happens
> when nobody checks before the work goes out."

**Performance by scope** is the other half of the argument: strong on routine
cases, weaker on complex ones. The aggregate would have hidden that.

### 3. Each level proves something different

Open two more scorecards and compare the criteria tables:

| Task | Stage | What it must prove |
|---|---|---|
| Risk detection | Shadow → Assisted | Is it right? |
| Detect invoice exceptions | Assisted → Supervised | Do humans keep having to correct it? |
| Match invoice to ledger | Supervised → Constrained | Is it safe when nobody pre-approves? |

> "These aren't the same test getting stricter. Nobody is relying on a Shadow
> task, so there's no override rate to measure. You can't measure what happens
> without pre-approval until you've stopped pre-approving. Each stage is the
> first one able to prove its own thing — so re-running the old benchmark can
> never get you to the next level."

### 4. The system recommends; a person decides · *Review autonomy decision*

On Routine rule application, click through to the decision screen.

> "It says what it recommends and why. It shows exactly what's being decided —
> this task, this scope, and explicitly *not* the agent's other three tasks.
>
> A reason is required. And if you disagree with the recommendation, you can —
> but the disagreement is recorded next to it, permanently."

**Then show what an override cannot do.** Go to **Draft tax position**:

> "This one's paused: the task is on rule 2.4, the checker is still on 2.3. So
> the evidence can't be trusted, and there's no Approve button at all. You can
> override a *recommendation*. You can't override the finding that the evidence
> isn't trustworthy."

### 5. The one that lands · *Routine rule application → Review classification*

Scroll to **Review classification**. A reviewer's free-text note, classified as
*Material error*, awaiting confirmation.

Click **Change classification → Critical error**, then scroll up.

> "Watch what just happened. Eligibility flipped to blocked. The criteria aren't
> assessed any more. And the recommendation changed to *Restrict scope* — because
> that error is in complex Australian cases while the routine ones are clean, so
> it's arguing for a narrower fence rather than stopping the whole task.
>
> The classification layer puts the review note into a bounded category. A person
> confirms anything consequential, and then fixed product rules determine what
> happens next."

*(Reset demo in the footer to undo.)*

### 6. Autonomy is not permanent · *Sandbox Revalidation*

> "Filing readiness had earned **L4 · Constrained** — the most freedom this
> product allows. Then the rulebook moved from 3.1 to 3.2.
>
> It's now back at **Shadow**. Not demoted as a punishment: the approval was
> always about a *configuration*, and that configuration no longer exists. The
> old approval stays on the record and confers nothing.
>
> Look at the results after the change: routine cases fine, complex Australian
> cases produced a critical error. So the recommendation is to bring the old
> level back for the part that held up, and leave the rest outside the fence."

Three options, none of them automatic.

### 7. The record · *Audit Log*

Open the detail on the 2026-05-18 promotion.

> "This decision was made on 240 Assisted-mode cases, under policy v1.2 and rule
> v3.1. That same task today has 342 Supervised-mode cases, policy v1.3, rule
> v3.2. Four numbers, all moved — and this record hasn't followed any of them.
>
> If you re-scored old decisions against today's rules, you'd have no idea what
> anyone actually knew when they decided."

Optional: go to **Policies & Versions**, tighten a threshold, save as a new
version, then come back. Every existing record is untouched.

---

## If you're asked about the architecture

> "Four layers, and the direction of authority only goes one way.
>
> Fixed rules do all the arithmetic and produce the recommendation. A small model
> can put ambiguous free text into a closed set of boxes — that's upstream of the
> decision, and a person confirms anything consequential before it counts. A
> second model rewrites the finished decision in plainer English — that's
> downstream, and if you deleted it every outcome would be identical. A person
> makes the call.
>
> Neither model can grant or withhold autonomy. That's not a policy anyone has to
> remember; the code physically can't do it, and there's a test that reads the
> engine's imports and fails if it ever could."

## Honest framing

- Synthetic data throughout. No real customer, accounting or production data.
- Threshold values are product assumptions, not accounting or regulatory standards.
- Not a product of any employer, and not a claim about anyone's internal systems.
- Some classifications are seeded rather than live. **About this prototype** in
  the footer says which, and updates itself when a live service is configured.
