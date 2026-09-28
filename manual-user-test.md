# Manual test checklist

**Site:** <https://autonomy-gate.vercel.app>
**Time needed:** 30–45 minutes
**You need:** a browser. Nothing to install, no login.

---

## Before you start

1. Open the site.
2. Look at the **footer**. If you see a button called **Reset demo**, click it, then
   click **Reset** to confirm. That clears any changes left from earlier visits so
   you start from the same place this checklist describes.
3. If there is no **Reset demo** button, you are already starting clean. Good.

Anything you change during this test is saved only in your own browser. Nobody
else sees it, and Reset demo puts everything back.

---

## Test 1 · One agent, several different levels of freedom

**Start:** the home page (**Agents & Tasks**).

**Do:** look at the **Invoice Helper** card and read down its four rows.

**Expect to see**

- Four tasks, each with its **own** autonomy level in the *Autonomy level* column:
  L4, L3, L3 and L2.
- **No autonomy level anywhere on the agent itself** — the agent heading has a
  name and a description, and that is all.
- The Tax Helper card below it, also with four tasks at mixed levels.

**Something is wrong if**

- All four tasks show the same level.
- You find a single autonomy level presented for the whole agent.
- Any row has an empty *Autonomy level* cell.

> **Why this matters:** this is the product's whole argument on one screen. If
> you granted autonomy to the agent, you would be granting it to the weakest
> thing that agent does.

---

## Test 2 · A task that has earned the right to more freedom

**Start:** home page.

**Do:** find a task whose *Recommendation* column says **Eligible for promotion**
(there are three). Note that its *Operational status* says **Healthy**. Click
**View scorecard** on **Detect invoice exceptions**.

**Expect to see**

- A recommendation to move up **one level only** — from L2 · Assisted to
  **L3 · Supervised**. Never a jump of two levels.
- An **Autonomy criteria** table where every row passes.
- Two of the criteria are about *humans correcting the agent* — an override rate
  and an escalation rate — not about raw accuracy.

**Something is wrong if**

- The recommendation skips a level (L2 straight to L4).
- The criteria are about accuracy only.
- "Eligible for promotion" is shown as a problem or a warning rather than as an
  opportunity.

---

## Test 3 · A task that is *not* allowed to move up, and why

**Start:** home page → **Routine rule application** → **View scorecard**.

**Do:** read the big **Recommendation** panel, then scroll to **Autonomy
criteria** and find the one row that fails.

**Expect to see**

- Recommendation: **Remain Supervised**.
- Eight criteria. Seven pass. Exactly one says **Needs improvement**:
  *confident-but-wrong*, showing about **0.88%** against a limit of **0.25%**.
- Below the table, an **Additional metrics** box containing **accuracy of about
  98.5%**, with a note saying these do not gate promotion.
- Further down, **Performance by scope**: strong on routine cases, weaker on
  complex Australian ones.

**Something is wrong if**

- More than one criterion fails, or none does.
- Accuracy appears *inside* the criteria table rather than in Additional metrics.
- Every scope row looks identical — the point is that one segment is weaker.

> **Why this matters:** the task is right 98.5% of the time and still cannot move
> up. What stops it is how often it was wrong *while being confident*. An average
> would have hidden that.

---

## Test 4 · The AI classification step, and your power over it

**Start:** still on the **Routine rule application** scorecard. Scroll to
**Review classification**.

**Do, in order:**

1. Read the reviewer's note in quotation marks, and the classification beside it
   (**Material error**), and the status (**Awaiting confirmation**).
2. Click **Classify the note again**. Wait a moment.
3. Note the confidence number in the grey suggestion line that appears.
4. Click **Classify the note again** two or three more times, noting the
   confidence each time.
5. Now click **Change classification**, then choose **Critical error**.
6. **Scroll back up to the top of the page.**

**Expect to see**

- At step 3: a line reading *"Suggested classification: Material error
  (confidence 0.9…). A suggestion is not evidence until you settle it."*
- At step 4: the **confidence value changes slightly between attempts** — 0.88,
  0.90, 0.91, 0.92 or similar. The classification itself stays *Material error*.
- At step 6, three things have changed at once:
  - **Eligibility** has flipped to **Blocked**.
  - The **Autonomy criteria** table is gone, replaced by *Not assessed*.
  - The **Recommendation** has changed to **Restrict scope**.

**Something is wrong if**

- The confidence is identical every single time (that would mean it is reading a
  saved value rather than asking the live service).
- An error message appears about human review — see the note below.
- Changing the classification changes nothing further up the page.
- The classification changes the autonomy level *directly*, without going
  through eligibility and the recommendation.

> **Why the varying confidence matters:** it is the visible proof that a real
> external service is being consulted, not a canned answer.

> **If you see "This case needs human review" instead:** that is the service
> being unavailable or rate-limited, and it is *correct behaviour*, not a bug.
> The case routes to a person and nothing about autonomy changes. You can
> confirm this: scroll up and check the recommendation still says *Remain
> Supervised*. Try again in a minute for the live path.

**Clean up:** click **Reset demo** in the footer, then **Reset**. Check the
recommendation on this page goes back to **Remain Supervised**.

---

## Test 5 · When the evidence itself cannot be trusted

**Start:** home page.

**Do:** look at the red banner near the top, then click through to **Draft tax
position** (Tax Helper's third task).

**Expect to see**

- On the home page: the task's status is **Paused**, with a note about a
  rule-version mismatch.
- On its scorecard, in **Current configuration**: the task is on rule **2.4**,
  the **evaluator is still on 2.3**, and the current rule set is **2.4**. Three
  versions, one of them out of step.
- **Autonomy criteria: Not assessed** — the product refuses to score it at all.
- In **Performance by scope**, all four rows say **Not assessed**.
- Click **Review autonomy decision**. There is **no Approve option at all** — only
  options that keep or reduce freedom.
- Read the scope-narrowing option carefully: it says **no segments are
  proposed**, and the narrower boundary is yours to choose.

**Something is wrong if**

- An Approve or Promote option appears.
- The criteria are scored anyway.
- The product suggests *which* segments to narrow to. It has just declared this
  evidence untrustworthy, so it must not then make a recommendation based on it.

> **Why this matters:** you can disagree with a recommendation. You cannot
> overrule the finding that the evidence is not trustworthy.

---

## Test 6 · Freedom already earned can be taken back

**Start:** the **Sandbox** tab in the top navigation.

**Do:** read the three cards across the top, then scroll to **Performance after
the change**, then to **Continuity decision**.

**Expect to see**

- Side by side: **Previous approved autonomy L4 · Constrained** and **Candidate
  state L1 · Shadow**. The task has gone back to the beginning.
- Wording making clear the old approval is *"kept as a record, not as an
  entitlement."*
- The reason: the rulebook moved from version **3.1 to 3.2**.
- In the results table: routine cases fine, complex Australian cases carrying a
  **critical error**.
- **Three options**, none of them pre-selected and none applied automatically.
- The **Record continuity decision** button is greyed out, and a line beside it
  explains exactly why: *"To record this decision, choose an outcome above and
  give a reason of at least 10 characters."*

**Do next:** pick an option. The greyed-out message should shorten to mention
only the missing reason. Type a few characters and watch the counter. The button
should stay greyed until you pass **10 characters**, then become clickable.

**Something is wrong if**

- The candidate starts at anything other than Shadow.
- The previous L4 is treated as still valid.
- The button is greyed out with **no explanation** of what is missing.
- The button is clickable with no reason typed.

---

## Test 7 · The system recommends, a person decides

**Start:** home page → **Routine rule application** → scroll to the bottom →
**Review autonomy decision**.

**Do:**

1. Read **Decision scope** — especially the right-hand column.
2. Choose the option that is **not** marked *Recommended*.
3. Notice what appears.
4. Type a reason of at least ten characters, optionally pick a **Category**.
5. Click **Confirm decision**.

**Expect to see**

- In Decision scope: an explicit list of the agent's **other tasks, unaffected**
  by this decision.
- On choosing a non-recommended option: a tag reading **Differs from
  recommendation**, and a **tick-box you must check** acknowledging the
  difference.
- The greyed-out button explains what is still missing until you have chosen an
  option, written a reason, and ticked the box.
- Above the category chips, a small label reading **Category (optional)** — so it
  is clear they are optional.
- After confirming: a **Decision recorded** panel, with a link into the Audit Log.

**Something is wrong if**

- You can record a decision with no reason.
- A disagreement with the recommendation is accepted silently, with no tag and
  no acknowledgement.
- The decision appears to change the agent's other tasks.

---

## Test 8 · The record does not get rewritten

**Start:** the **Audit Log** tab.

**Do:** find the entry dated **2026-05-18** and open its detail. Write these four
values on paper: the **policy version**, the **rule version**, the **number of
cases**, and the **autonomy mode**.

Then go to **Policies & Versions**, tighten any threshold, and save it as a new
version. Then return to the **Audit Log** and reopen the same 2026-05-18 entry.

**Expect to see**

- Originally: policy **v1.2**, rule **v3.1**, **240** cases, **Assisted** mode.
- After publishing a new policy version: **all four values are exactly the same.**
- Your new policy version appears as its **own new entry**, without altering any
  existing one.

**Something is wrong if**

- Any number in the old record changes.
- The old record now shows today's policy version.
- Publishing a policy silently rewrites history.

> **Why this matters:** if old decisions were re-scored against today's rules,
> you would have no idea what anyone actually knew when they decided.

---

## Test 9 · Your changes survive, and stay yours

**Start:** anywhere, after you have recorded at least one decision or
classification.

**Do:**

1. Press **F5** to refresh the page.
2. Click into another tab in the navigation and back again.
3. Use your browser's **Back** and **Forward** buttons a few times.
4. Copy the address of a task scorecard, open a **new tab**, and paste it in.
5. Open a **private / incognito window** and go to the site.

**Expect to see**

- Steps 1–4: your change is still there. A blue-bordered note explains what you
  changed and how to undo it.
- Back and Forward move between screens normally, with no blank pages and no
  error.
- A pasted task address loads that task's scorecard directly.
- Step 5: the incognito window starts **completely clean** — no decisions, the
  original levels, and no Reset demo button in the footer.

**Something is wrong if**

- Your change vanishes on refresh.
- Your change shows up in the incognito window (it should not — it is stored in
  your browser only).
- Back or Forward produces a blank screen or an error.
- A pasted address gives a "not found" page.

---

## Test 10 · Putting it all back

**Start:** anywhere with the footer visible.

**Do:** click **Reset demo**, read the confirmation, then click **Reset**.

**Expect to see**

- The confirmation names **how many changes** you are discarding, and the number
  matches roughly what you did.
- After resetting: the **Reset demo** button disappears entirely.
- Every screen returns to how it looked at the start — Routine rule application
  back to **Remain Supervised**, all blue "you changed this" notes gone.

**Something is wrong if**

- The count says **0** while there is clearly something to undo.
- Resetting leaves some of your changes behind.
- The button is still there after resetting.

---

## Also worth a glance

**On your phone.** Open the site on a mobile. Check that you can reach **every**
navigation item — the strip scrolls sideways if it needs to, and **Audit Log**
must be reachable. Wide tables scroll sideways inside their own box; the page
itself should never scroll sideways.

**The honesty panel.** Click **About this prototype** in the footer. It should say
review classifications are **"produced by a live external service"**, and that
plain-language summaries are **"written from fixed templates"**. Both statements
should match what you actually saw. It should also say the data is synthetic and
that thresholds are product assumptions, not accounting standards.

---

## If you only have ten minutes

Do tests **1**, **3**, **4** and **5**, in that order. Those four carry the
argument: autonomy is per task, earning it means passing a stage-specific bar,
a model can categorise evidence but never decide, and untrustworthy evidence
stops everything.
