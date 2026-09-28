# TypeSafe / Jev adapter notes

Feasibility spike run before Phase 0. **No provider code was written.** The real
`TypeSafeJevProvider` is still built in Phase 11.

Evidence: `@typesafe-ai/sdk@0.6.0` (MIT, zero runtime dependencies, published ~1 week ago),
inspected from its published type definitions (`dist/index.d.mts`), not from prose docs.

## Verdict: the planned interface is viable, unchanged

`JudgmentProvider` with `classifyError()`, `classifyComplexity()` and `evaluateEvidenceState()`
sits cleanly on top of the SDK. All three are `choice` questions.

```
client.systemOne({ state, questions: { severity: choice(instructions, criteria) } })
  -> { model, answers: { severity: { type, choice, confidence, probabilities } }, usage }
```

- `choice(instructions, criteria)` takes `criteria` as `{ label: description }` — exactly our
  closed vocabularies (`no_error | minor_error | material_error | critical_error | uncertain`,
  `routine | complex | uncertain`, `sufficient | incomplete | contradictory | unclear`).
- `ChoiceResponse` returns `choice`, `confidence` **and** `probabilities` per label.
  `confidence` maps directly onto `JevJudgment.confidence` in PRD §22.8.
- `uncertain` is ours to supply as a label. The API does not emit an out-of-band "unsure"
  value, which is exactly what we want: the fallback stays inside our vocabulary.
- Endpoint `POST https://api.typesafe.ai/v1/systemone`, env var `TYPESAFE_API_KEY`,
  default model `jev-latest`. All as assumed.

## Constraints to remember at Phase 11

1. **Node runtime, not Edge.** The package declares `engines.node >= 20` and the client
   constructor throws on an unsupported runtime. `app/api/judgment/route.ts` must pin
   `export const runtime = "nodejs"`.
2. **Never set `dangerouslyAllowBrowser`.** It defaults to `false`, so the SDK itself refuses
   browser use. That enforces our server-side-only rule at the library level — leave it alone.
3. **Still validate the returned label at runtime.** TypeScript narrows `choice` to
   `keyof criteria`, but that is a compile-time guarantee about a network response. Anything
   outside the vocabulary is treated as `uncertain` and routed to a human.
4. **Typed errors map straight onto the human-fallback path.** `APITimeoutError`,
   `APIConnectionError`, `RateLimitError`, `AuthenticationError`, `APIError` — every one
   routes the case to human review. Never a fabricated default.
5. **Built-in retries are on by default** (2 retries, exponential backoff, honours
   `Retry-After`). Do not add a second retry layer on top.
6. **Batching is available if ever needed.** `questions` is a map, so several named questions
   about the same `state` can share one round trip. Not needed for V1; the three-method
   interface stays as planned, and an internal batch would not change it.
7. **`confidence` is a routing signal, not a gate.** Per the agreed guidance, no universal
   numeric cutoff is chosen up front. Consequential and `uncertain` classifications follow the
   PRD's human-confirmation rules; any numeric threshold is tuned later against the labelled
   prototype cases.

## Unchanged by this spike

Nothing in the approved plan required amendment for TypeSafe. The one addition is
constraint (1), which is recorded against Phase 9 (the phase that writes the route handler)
so the runtime pin is not discovered late.
