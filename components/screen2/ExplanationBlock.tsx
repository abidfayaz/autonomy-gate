"use client";

import { useEffect, useState } from "react";
import type { ReasonCode } from "@/lib/engine";

/**
 * The wording under a recommendation.
 *
 * The deterministic summary renders immediately and is what the screen shows if
 * nothing better arrives. A rephrasing may replace it, and the label changes
 * quietly when it does.
 *
 * Nothing here ever reports a provider problem. A person reading a governance
 * decision does not need to know which service answered, and an outage is not
 * their concern: the decision is unaffected either way.
 */
export function ExplanationBlock({
  code,
  targetLevelLabel,
  detail,
  standard,
}: {
  code: ReasonCode;
  targetLevelLabel: string | null;
  detail: Record<string, string | number | null>;
  standard: string;
}) {
  const [summary, setSummary] = useState(standard);
  const [source, setSource] = useState<"standard" | "live">("standard");

  // Reset when the decision changes, so a rephrasing of an earlier outcome is
  // never left sitting under a new one. Deliberately an effect and not a `key`:
  // showing the wrong decision's wording is the failure this guards against, and
  // it must clear even when the surrounding element is reused.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setSummary(standard);
    setSource("standard");
  }, [standard]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, target_level_label: targetLevelLabel, detail }),
        });
        if (!response.ok || !active) return;
        const body = (await response.json()) as { summary?: string; source?: string };
        if (!active || typeof body.summary !== "string" || body.summary.length === 0) return;
        setSummary(body.summary);
        setSource(body.source === "live" ? "live" : "standard");
      } catch {
        // The deterministic wording is already on screen. Nothing to report.
      }
    })();
    return () => {
      active = false;
    };
  }, [code, targetLevelLabel, detail]);

  return (
    <>
      <p className="mt-space-sm max-w-md font-body-md text-body-md text-on-surface-variant">
        {summary}
      </p>
      <p className="mt-space-md font-body-md text-body-sm text-outline">
        {source === "live" ? "Plain-language summary" : "Standard summary"}
      </p>
    </>
  );
}
