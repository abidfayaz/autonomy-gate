import type { ReactNode } from "react";
import { judgmentProviderStatus } from "@/lib/judgment/status";
import { DemoStateProvider } from "@/lib/state/DemoStateProvider";
import { AboutPanel } from "./AboutPanel";
import { ResetDemo } from "./ResetDemo";
import { Icon } from "./Icon";
import { Nav } from "./Nav";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/config/routes";

/**
 * Persistent application chrome. Follows the approved reference screens, with the
 * corrections agreed during clarification: no product version badge in the header
 * (policy versions already use v1.x and the two were being confused).
 */
export function AppShell({ children }: { children: ReactNode }) {
  // Read on the server, so the disclosure states what is actually configured
  // rather than what might be.
  const classificationIsLive = judgmentProviderStatus().live;
  const explanationIsLive = Boolean(process.env.GROQ_API_KEY?.trim());

  return (
    <DemoStateProvider>
      <header className="sticky top-0 z-40 border-b border-outline-variant/40 bg-surface-container-low/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-space-md px-margin-desktop py-space-md">
          <div className="flex items-center gap-space-md">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
              <Icon name="verified_user" />
            </span>
            <div>
              <p className="whitespace-nowrap font-headline-sm text-headline-sm leading-none text-on-surface">
                {PRODUCT_NAME}
              </p>
              <p className="mt-1 hidden font-body-md text-body-sm text-on-surface-variant lg:block">
                {PRODUCT_TAGLINE}
              </p>
            </div>
          </div>

          <Nav />

          <div className="flex items-center gap-space-md">
            <span className="rounded-full border border-outline-variant/60 px-space-sm py-space-xs font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
              Prototype
            </span>
            <div className="flex items-center gap-space-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                <Icon name="person" />
              </span>
              <div className="leading-tight">
                <p className="font-body-md text-body-sm text-on-surface">Maya</p>
                <p className="font-body-md text-body-sm text-on-surface-variant">
                  AI Ops &amp; Governance
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-margin-desktop py-space-lg">
        {children}
      </main>

      <footer className="border-t border-outline-variant/40 bg-surface-container-low">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-space-md px-margin-desktop py-space-md">
          <p className="font-label-md text-label-sm uppercase tracking-wide text-on-surface-variant">
            Task-level autonomy governance // Synthetic prototype data
          </p>
          <div className="flex flex-wrap items-center gap-space-md">
            <ResetDemo />
            <AboutPanel
              classificationIsLive={classificationIsLive}
              explanationIsLive={explanationIsLive}
            />
            <p className="font-body-md text-body-sm text-on-surface-variant">
              {PRODUCT_NAME} • Prototype
            </p>
          </div>
        </div>
      </footer>
    </DemoStateProvider>
  );
}
