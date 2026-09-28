"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { hasVisitorChanges } from "@/lib/state/demoState";
import { useDemoState } from "@/lib/state/DemoStateProvider";

/**
 * Restores the seeded state.
 *
 * Only offered once there is something to undo, and confirmed before it runs:
 * discarding someone's decisions without asking is the kind of surprise a
 * governance product should not model.
 */
export function ResetDemo() {
  const { state, ready, reset } = useDemoState();
  const [confirming, setConfirming] = useState(false);

  if (!ready || !hasVisitorChanges(state)) return null;

  // Every kind of change, not only decisions: the control appears for any of
  // them, so counting one kind made it read "Reset demo (0)" with work to undo.
  const count =
    state.decisions.length + state.policies.length + state.classifications.length;

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-space-sm">
        <span className="font-body-md text-body-sm text-on-surface-variant">
          Discard {count} recorded {count === 1 ? "change" : "changes"}?
        </span>
        <button
          type="button"
          onClick={() => {
            reset();
            setConfirming(false);
          }}
          className="rounded-lg border border-error/50 px-space-sm py-space-xs font-body-md text-body-sm text-error hover:bg-error/10"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-lg px-space-sm py-space-xs font-body-md text-body-sm text-on-surface-variant hover:bg-surface-container"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-space-xs rounded-lg border border-outline-variant/50 px-space-sm py-space-xs font-body-md text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
    >
      <Icon name="restart_alt" className="text-[16px] leading-none" />
      Reset demo ({count})
    </button>
  );
}
