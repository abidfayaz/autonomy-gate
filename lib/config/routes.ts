/**
 * The four top-level destinations from the approved reference screens.
 * Task Scorecard and Autonomy Decision Review are intentionally absent: both are
 * drill-downs beneath a task and are meaningless without a task in hand.
 */
export const NAV_ITEMS = [
  { href: "/", label: "Agents & Tasks", icon: "account_tree" },
  { href: "/policies", label: "Policies & Versions", icon: "rule_folder" },
  { href: "/sandbox", label: "Sandbox Revalidation", icon: "science" },
  { href: "/audit", label: "Audit Log", icon: "history" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

export const PRODUCT_NAME = "Autonomy Gate";
export const PRODUCT_TAGLINE = "Evidence-based autonomy for AI tasks";

/** Shown wherever the prototype must state that its data is not real. */
export const SYNTHETIC_DATA_NOTICE = "Synthetic prototype data";
