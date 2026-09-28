import type { AutonomyLevel, OperationalState } from "@/lib/domain/types";
import { AUTONOMY_LABELS } from "@/lib/domain/vocabulary";
import type { SignalTone } from "@/lib/view/agentsAndTasks";
import { Icon } from "./Icon";

/**
 * Autonomy level, operational state and recommendation are three different
 * things, so they are three visually distinct badges. Collapsing them into one
 * column is what made the reference screens read as though being ready for
 * promotion were a kind of problem.
 */

const LEVEL_STYLES: Record<AutonomyLevel, string> = {
  shadow: "border-outline-variant/70 bg-surface-container-high text-on-surface-variant",
  assisted: "border-secondary/40 bg-secondary/10 text-secondary",
  supervised: "border-primary/40 bg-primary/10 text-primary",
  constrained: "border-tertiary/40 bg-tertiary/10 text-tertiary",
};

export function AutonomyBadge({
  level,
  className,
}: {
  level: AutonomyLevel;
  className?: string;
}) {
  const { code, name } = AUTONOMY_LABELS[level];
  return (
    <span
      className={`inline-flex items-center gap-space-xs whitespace-nowrap rounded-full border px-space-sm py-space-xs font-label-md text-label-md ${LEVEL_STYLES[level]} ${className ?? ""}`}
    >
      <span className="font-label-md">{code}</span>
      <span aria-hidden="true" className="opacity-50">
        ·
      </span>
      <span className="font-body-md text-body-sm">{name}</span>
    </span>
  );
}

const STATE_STYLES: Record<OperationalState, { dot: string; text: string }> = {
  healthy: { dot: "bg-tertiary", text: "text-on-surface-variant" },
  "needs-review": { dot: "bg-secondary", text: "text-secondary" },
  sandbox: { dot: "bg-secondary", text: "text-secondary" },
  paused: { dot: "bg-error", text: "text-error" },
};

export function StateBadge({
  state,
  label,
}: {
  state: OperationalState;
  label: string;
}) {
  const style = STATE_STYLES[state];
  return (
    <span className={`inline-flex items-center gap-space-sm whitespace-nowrap ${style.text}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      <span className="font-body-md text-body-sm">{label}</span>
    </span>
  );
}

const SIGNAL_STYLES: Record<SignalTone, string> = {
  positive: "border-tertiary/40 bg-tertiary/10 text-tertiary",
  neutral: "border-outline-variant/60 bg-surface-container text-on-surface-variant",
  warning: "border-secondary/40 bg-secondary/10 text-secondary",
  critical: "border-error/40 bg-error/10 text-error",
};

const SIGNAL_ICONS: Record<SignalTone, string> = {
  positive: "trending_up",
  neutral: "pause_circle",
  warning: "science",
  critical: "warning",
};

export function SignalBadge({ signal, tone }: { signal: string; tone: SignalTone }) {
  return (
    <span
      className={`inline-flex items-center gap-space-xs whitespace-nowrap rounded-full border px-space-sm py-space-xs font-body-md text-body-sm ${SIGNAL_STYLES[tone]}`}
    >
      <Icon name={SIGNAL_ICONS[tone]} className="text-[14px] leading-none" />
      {signal}
    </span>
  );
}
