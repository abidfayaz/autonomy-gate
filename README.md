# Autonomy Gate

A synthetic portfolio prototype demonstrating how AI autonomy is **earned and governed at the
task level** — never at the whole-agent level.

Each task proves something different at each stage: Shadow tests correctness, Assisted tests
whether humans can rely on recommendations, Supervised tests whether the task stays safe
without pre-approval, and Constrained allows independent operation only inside an explicitly
approved boundary. Deterministic policy logic produces the recommendation, bounded machine
judgment helps classify ambiguous evidence, a small model explains the result in plain
language, and a human makes the final decision.

> Not a Zato product. No real customer, internal or production data. Threshold values are
> configurable product assumptions, not accounting or regulatory standards.

## Running locally

```bash
npm install
npm run dev
```

The product runs fully with **no environment variables**: the deterministic engine owns every
autonomy outcome. See `.env.example` for the two optional model-backed layers.

```bash
npm run check   # typecheck + tests + production build
npm run seed    # regenerate data/seed/dataset.json from the fixed seed
```

## Open items

Pending decisions, accepted deviations and carried-forward work are tracked in
[docs/open-items.md](docs/open-items.md).

## Source of truth

- **Product behaviour** — `Autonomy_Gate_PRD_v1.0_Final.md`, plus the recorded clarification
  decisions.
- **Visual direction** — the six approved `Autonomy_Gate_*.html` reference screens.
  Design tokens are extracted from them programmatically into `design/tokens.json`.
- **Build sequence** — the approved progressive implementation plan and `docs/plan-amendments.md`.

## Deploying

Zero-config on Vercel; the app needs no environment variables to run.

```bash
npx vercel login
npx vercel --prod
```

## Build status

| Phase | Scope | State |
|---|---|---|
| 0 | Foundation, chrome, six routes, test harness | Done |
| 1 | Domain model + canonical synthetic dataset | Done |
| 2 | Deterministic engine | Done |
| 3 | Screen 1 · Agents & Tasks → first public deploy | Done (deploy pending login) |
| 4 | Screen 2 · Task Scorecard | Done |
| 5 | Screen 3 · Decision + persistence + reset | Done |
| 5.5 | Comprehension checkpoint | Done |
| 6 | Screen 6 · Audit Log | Done |
| 7 | Screen 5 · Policies & Versions | Done |
| 8 | Screen 4 · Sandbox Revalidation | Done |
| 9 | Bounded judgment layer → first demo milestone | Done |
| 10 | Explanation layer | Done |
| 11 | Real TypeSafe provider + disclosure | Done |
| 12 | Content pass, acceptance matrix, demo script | Next |
