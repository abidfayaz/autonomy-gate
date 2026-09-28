"use client";

import { useState } from "react";
import { Panel } from "@/components/screen2/Sections";
import type { ErrorClassification } from "@/lib/domain/types";
import { classificationFor, type RecordedClassification } from "@/lib/state/demoState";
import { useDemoState } from "@/lib/state/DemoStateProvider";
import type { ClassificationView } from "@/lib/view/taskScorecard";

/**
 * Review classification.
 *
 * The one place a person resolves a bounded classification, and the only way one
 * becomes evidence. Resolving it recomputes eligibility and the recommendation
 * immediately: bounded judgment, human confirmation, deterministic consequence,
 * in that order and no other.
 */

const LABELS: Record<ErrorClassification, string> = {
  no_error: "No error",
  minor_error: "Minor error",
  material_error: "Material error",
  critical_error: "Critical error",
  uncertain: "Uncertain",
};

const DESCRIPTIONS: Record<ErrorClassification, string> = {
  no_error: "No substantive problem.",
  minor_error: "A small issue with limited impact.",
  material_error: "A meaningful issue requiring correction.",
  critical_error: "A serious issue that should block progression.",
  uncertain: "Cannot be classified confidently.",
};

const OPTIONS: ErrorClassification[] = [
  "no_error",
  "minor_error",
  "material_error",
  "critical_error",
];

const TODAY = "2026-09-28";

export function ClassificationPanel({
  view,
  taskId,
  judgmentId,
  runId,
}: {
  view: ClassificationView | null;
  taskId: string;
  judgmentId: string | null;
  runId: string | null;
}) {
  const { state, recordClassification } = useDemoState();
  const [changing, setChanging] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    result: ErrorClassification;
    confidence: number;
    live: boolean;
    limited: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!view) return null;

  const own = judgmentId ? classificationFor(state, judgmentId) : undefined;
  const settled = own?.resolved ?? view.confirmed;
  const shown = own ? LABELS[own.result] : view.result_label;

  const record = (result: ErrorClassification, resolved: boolean) => {
    if (!judgmentId || !runId) return;
    const entry: RecordedClassification = {
      judgment_id: judgmentId,
      task_id: taskId,
      run_id: runId,
      result,
      resolved,
      confirmed_at: TODAY,
      reviewer: "Maya",
    };
    recordClassification(entry);
    setChanging(false);
  };

  /**
   * Asks the bounded-judgment layer to classify the note again.
   *
   * The answer is a suggestion. It is not evidence until a person accepts it,
   * and a failure or an unrecognised answer routes to them rather than
   * producing a default.
   */
  const rerun = async () => {
    if (!judgmentId) return;
    setRerunning(true);
    setError(null);
    setSuggestion(null);
    try {
      const response = await fetch("/api/judgment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The classification is named, not carried. The server holds the note.
        body: JSON.stringify({ judgment_id: judgmentId, question: "error" }),
      });
      if (!response.ok) {
        setError("Classification is unavailable. This case needs human review.");
        return;
      }
      const body = (await response.json()) as {
        result?: ErrorClassification;
        confidence?: number;
        live?: boolean;
        limited?: boolean;
      };
      if (!body.result || body.result === "uncertain") {
        setError("The note could not be classified confidently. This case needs human review.");
        return;
      }
      setSuggestion({
        result: body.result,
        confidence: body.confidence ?? 0,
        live: body.live ?? false,
        limited: body.limited ?? false,
      });
    } catch {
      setError("Classification is unavailable. This case needs human review.");
    } finally {
      setRerunning(false);
    }
  };

  return (
    <Panel
      title="Review classification"
      status={settled ? "Confirmed" : "Awaiting confirmation"}
      statusTone={settled ? "positive" : "critical"}
      description="How an ambiguous reviewer note was classified before it contributes to autonomy evidence. It counts as evidence only once a person settles it."
    >
      <figure className="rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
        <blockquote className="font-body-md text-body-md text-on-surface">
          &ldquo;{view.reviewer_note}&rdquo;
        </blockquote>
        <figcaption className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
          Reviewer note
        </figcaption>
      </figure>

      <dl className="mt-space-md grid gap-space-md sm:grid-cols-3">
        <div>
          <dt className="font-body-md text-body-sm text-on-surface-variant">Classification</dt>
          <dd className="mt-1 font-body-md text-body-md text-on-surface">{shown}</dd>
        </div>
        <div>
          <dt className="font-body-md text-body-sm text-on-surface-variant">
            Classification confidence
          </dt>
          <dd className="mt-1 font-label-md text-label-md text-on-surface">
            {view.confidence_display}
          </dd>
        </div>
        <div>
          <dt className="font-body-md text-body-sm text-on-surface-variant">Human review</dt>
          <dd className="mt-1 font-body-md text-body-md text-on-surface">
            {own
              ? own.resolved
                ? `Settled by ${own.reviewer}`
                : "Routed for further review"
              : view.requires_confirmation
                ? "Confirmation required"
                : "Not required"}
          </dd>
        </div>
      </dl>

      {own ? (
        <p className="mt-space-md rounded-lg border border-secondary/40 bg-secondary/5 p-space-md font-body-md text-body-sm text-on-surface-variant">
          {own.resolved
            ? `You settled this as ${LABELS[own.result]}. The evidence below reflects that.`
            : "You routed this for further review. Until it is settled it is not evidence, and the evaluation proceeds without it."}
        </p>
      ) : null}

      {!settled && judgmentId ? (
        <div className="mt-space-lg">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {view.status_detail}
          </p>

          {!changing ? (
            <div className="mt-space-md flex flex-wrap gap-space-md">
              <button
                type="button"
                onClick={() => record(suggestion?.result ?? view.result, true)}
                className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-body-md text-on-primary hover:opacity-90"
              >
                Confirm as {suggestion ? LABELS[suggestion.result] : view.result_label}
              </button>
              <button
                type="button"
                onClick={() => setChanging(true)}
                className="rounded-lg border border-outline-variant/50 px-space-lg py-space-sm font-body-md text-body-md text-on-surface-variant hover:bg-surface-container"
              >
                Change classification
              </button>
              <button
                type="button"
                onClick={() => record("uncertain", false)}
                className="rounded-lg border border-outline-variant/50 px-space-lg py-space-sm font-body-md text-body-md text-on-surface-variant hover:bg-surface-container"
              >
                Needs further review
              </button>
              <button
                type="button"
                onClick={rerun}
                disabled={rerunning}
                className="rounded-lg px-space-lg py-space-sm font-body-md text-body-md text-primary hover:bg-surface-container-high disabled:opacity-50"
              >
                {rerunning ? "Classifying…" : "Classify the note again"}
              </button>
            </div>
          ) : (
            <fieldset className="mt-space-md">
              <legend className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
                Choose a classification
              </legend>
              <div className="mt-space-sm grid gap-space-sm sm:grid-cols-2">
                {OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => record(option, true)}
                    className="rounded-lg border border-outline-variant/40 p-space-md text-left transition-colors hover:border-primary hover:bg-surface-container"
                  >
                    <span className="block font-body-md text-body-md text-on-surface">
                      {LABELS[option]}
                    </span>
                    <span className="mt-1 block font-body-md text-body-sm text-on-surface-variant">
                      {DESCRIPTIONS[option]}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setChanging(false)}
                className="mt-space-md rounded-lg px-space-md py-space-xs font-body-md text-body-sm text-on-surface-variant hover:bg-surface-container"
              >
                Cancel
              </button>
            </fieldset>
          )}

          {suggestion ? (
            <div className="mt-space-md rounded-lg border border-outline-variant/30 bg-surface-container p-space-md">
              <p className="font-body-md text-body-sm text-on-surface-variant">
                Suggested classification: {LABELS[suggestion.result]} (confidence{" "}
                {suggestion.confidence.toFixed(2)}). A suggestion is not evidence until you settle
                it.
              </p>
              {/* Said plainly rather than quietly substituted: this product's
                  argument is that it tells you which parts are live. */}
              {suggestion.limited ? (
                <p className="mt-space-sm font-body-md text-body-sm text-on-surface-variant">
                  Live classification is rate-limited right now, so this is the seeded response.
                  It is still bounded to the same fixed set of options, a person still settles it,
                  and autonomy is unaffected either way.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="mt-space-md rounded-lg border border-error/40 bg-error/5 p-space-md font-body-md text-body-sm text-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-space-md font-body-md text-body-sm text-on-surface-variant">
          {own?.resolved
            ? "Classification recorded for evaluation."
            : view.status_detail}
        </p>
      )}
    </Panel>
  );
}
