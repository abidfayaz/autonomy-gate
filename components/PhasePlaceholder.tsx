import { Icon } from "./Icon";

type PhasePlaceholderProps = {
  screen: string;
  purpose: string;
  /** What this screen will answer once it is built, taken from the PRD. */
  answers: readonly string[];
  phase: string;
};

/**
 * Honest placeholder for a route that exists but is not yet implemented.
 * Deliberately shows no metrics, levels or counts: nothing here should imply
 * that evaluation data exists before the engine and dataset are built.
 */
export function PhasePlaceholder({ screen, purpose, answers, phase }: PhasePlaceholderProps) {
  return (
    <section className="mx-auto max-w-3xl py-space-xl">
      <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
        {phase}
      </p>
      <h1 className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">{screen}</h1>
      <p className="mt-space-md font-body-md text-body-lg text-on-surface-variant">{purpose}</p>

      <div className="mt-space-lg rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
        <div className="flex items-center gap-space-sm text-on-surface-variant">
          <Icon name="construction" className="text-secondary" />
          <p className="font-body-md text-body-md">Not implemented yet.</p>
        </div>
        <p className="mt-space-sm font-body-md text-body-md text-on-surface-variant">
          This screen will answer:
        </p>
        <ul className="mt-space-sm space-y-space-xs">
          {answers.map((answer) => (
            <li
              key={answer}
              className="flex gap-space-sm font-body-md text-body-md text-on-surface-variant"
            >
              <span aria-hidden="true" className="text-outline">
                —
              </span>
              <span>{answer}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
