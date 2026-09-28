import { Icon } from "@/components/Icon";
import { AuditLogClient } from "@/components/screen6/AuditLogClient";
import { buildAuditView } from "@/lib/view/auditLog";

/**
 * Screen 6 - Audit Log.
 *
 * The seeded history is read on the server; this visitor's own decisions are
 * merged in by the client, since they live only in their browser.
 */
export default function AuditLogPage() {
  const view = buildAuditView();

  return (
    <div className="space-y-space-lg py-space-md">
      <header>
        <span className="inline-flex items-center gap-space-xs rounded-full border border-outline-variant/50 px-space-sm py-space-xs font-body-md text-body-sm text-on-surface-variant">
          <Icon name="info" className="text-[14px] leading-none" />
          Synthetic prototype data
        </span>
        <h1 className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">
          Audit log
        </h1>
        <p className="mt-space-sm max-w-3xl font-body-md text-body-lg text-on-surface-variant">
          The history of autonomy decisions, policy changes, revalidation outcomes and evaluation
          issues. Each record says what happened, who decided, why, and under which policy and rule
          version.
        </p>
      </header>

      <AuditLogClient view={view} />
    </div>
  );
}
