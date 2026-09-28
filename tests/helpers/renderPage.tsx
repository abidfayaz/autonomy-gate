import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { DemoStateProvider } from "@/lib/state/DemoStateProvider";

/**
 * Renders a page the way the app does.
 *
 * The real tree gets its visitor state from the layout, so a page rendered
 * without that provider is not the page anyone sees.
 */
export function renderWithProviders(ui: ReactElement) {
  return render(<DemoStateProvider>{ui}</DemoStateProvider>);
}
