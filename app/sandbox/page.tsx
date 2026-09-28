import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SandboxClient } from "@/components/screen4/SandboxClient";
import { buildSandboxView } from "@/lib/view/sandbox";

/**
 * Screen 4 - Sandbox Revalidation.
 *
 * One active revalidation at a time in this prototype, so the page opens on it
 * directly rather than through a list of one.
 */
export default function SandboxRevalidationPage() {
  const view = buildSandboxView();

  return (
    <div className="space-y-space-lg py-space-md">
      <nav aria-label="Breadcrumb" className="font-body-md text-body-sm text-on-surface-variant">
        <ol className="flex flex-wrap items-center gap-space-xs">
          <li>
            <Link href="/" className="hover:text-on-surface hover:underline">
              Agents &amp; Tasks
            </Link>
          </li>
          {view ? (
            <>
              <li aria-hidden="true">/</li>
              <li>{view.agent_name}</li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/tasks/${view.task_id}`}
                  className="hover:text-on-surface hover:underline"
                >
                  {view.task_name}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="text-on-surface">Sandbox revalidation</li>
        </ol>
      </nav>

      <header>
        <span className="inline-flex items-center gap-space-xs rounded-full border border-outline-variant/50 px-space-sm py-space-xs font-body-md text-body-sm text-on-surface-variant">
          <Icon name="info" className="text-[14px] leading-none" />
          Synthetic prototype data
        </span>
        <h1 className="mt-space-sm font-headline-xl text-headline-xl text-on-surface">
          Sandbox revalidation
        </h1>
        <p className="mt-space-sm max-w-3xl font-body-md text-body-lg text-on-surface-variant">
          Revalidate a changed configuration before previously approved autonomy can continue.
          {view ? ` ${view.agent_name} · ${view.task_name} · ${view.trigger}.` : ""}
        </p>
      </header>

      {view ? (
        <SandboxClient view={view} />
      ) : (
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-space-lg">
          <div className="flex items-center gap-space-sm">
            <Icon name="science" className="text-on-surface-variant" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              No revalidation in progress
            </h2>
          </div>
          <p className="mt-space-sm max-w-2xl font-body-md text-body-md text-on-surface-variant">
            Nothing has changed materially enough to need revalidating. A new model version, rule
            update, changed decision logic, new jurisdiction or task redefinition would open one.
          </p>
        </section>
      )}
    </div>
  );
}
