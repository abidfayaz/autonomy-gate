import { Icon } from "@/components/Icon";
import { PoliciesClient } from "@/components/screen5/PoliciesClient";
import { buildPoliciesView } from "@/lib/view/policies";

/**
 * Screen 5 - Policies & Versions.
 *
 * Policy configuration, deliberately separate from how a task is performing.
 * Performance belongs on the scorecard.
 */
export default function PoliciesAndVersionsPage() {
  const view = buildPoliciesView();

  return (
    <div className="space-y-space-lg py-space-md">
      <header>
        <span className="inline-flex items-center gap-space-xs rounded-full border border-outline-variant/50 px-space-sm py-space-xs font-body-md text-body-sm text-on-surface-variant">
          <Icon name="info" className="text-[14px] leading-none" />
          Synthetic prototype data
        </span>
        <h1 className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">
          Policies &amp; versions
        </h1>
        <p className="mt-space-sm max-w-3xl font-body-md text-body-lg text-on-surface-variant">
          The criteria each task is evaluated against, and whether its rules are still current.
          Editing a threshold publishes a new policy version; earlier versions, and the decisions
          made under them, are kept.
        </p>
      </header>

      <PoliciesClient view={view} />
    </div>
  );
}
