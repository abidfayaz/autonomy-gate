"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * Prototype disclosure.
 *
 * The one place the product says what is real and what is seeded. It is here,
 * rather than on a governance screen, so the screens themselves stay free of
 * implementation detail; and it states what is actually configured rather than
 * what might be, because a seeded classification presented as a live one would
 * be the single most misleading thing this prototype could do.
 */
export function AboutPanel({
  classificationIsLive = false,
  explanationIsLive = false,
}: {
  classificationIsLive?: boolean;
  explanationIsLive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg font-body-md text-body-sm text-on-surface-variant underline decoration-outline-variant underline-offset-2 transition-colors hover:text-on-surface"
      >
        About this prototype
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-prototype-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/80 p-margin"
        >
          <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg shadow-xl">
            <div className="flex items-start justify-between gap-space-md">
              <h2
                id="about-prototype-title"
                className="font-headline-sm text-headline-sm text-on-surface"
              >
                About this prototype
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-space-xs text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <Icon name="close" />
              </button>
            </div>

            <p className="mt-space-md font-body-md text-body-md text-on-surface-variant">
              This is a synthetic portfolio prototype. It does not use real customer or accounting
              data. Autonomy recommendations are generated from explicit product rules, and final
              decisions remain human-controlled.
            </p>

            <dl className="mt-space-lg space-y-space-md">
              <div>
                <dt className="font-body-md text-body-md text-on-surface">
                  Review classifications
                </dt>
                <dd className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
                  {classificationIsLive
                    ? "Currently produced by a live external service. The answer is limited to a fixed set of options, and a person confirms it before it counts as evidence."
                    : "Currently seeded prototype responses, not a live external service. They behave the same way: limited to a fixed set of options, and confirmed by a person before they count as evidence."}
                </dd>
              </div>

              <div>
                <dt className="font-body-md text-body-md text-on-surface">
                  Plain-language summaries
                </dt>
                <dd className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
                  {explanationIsLive
                    ? "Currently rephrased by a live external service. It receives a decision that has already been made and cannot change it."
                    : "Currently written from fixed templates, not a live external service. Either way the wording describes a decision that has already been made and cannot change it."}
                </dd>
              </div>

              <div>
                <dt className="font-body-md text-body-md text-on-surface">Your changes</dt>
                <dd className="mt-space-xs font-body-md text-body-sm text-on-surface-variant">
                  Decisions, policy versions and classifications you record are kept in your own
                  browser. Nobody else sees them, and Reset demo removes them.
                </dd>
              </div>
            </dl>

            <p className="mt-space-lg font-body-md text-body-sm text-on-surface-variant">
              Threshold values shown in this prototype are configurable product assumptions. They
              are not accounting or regulatory standards.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
