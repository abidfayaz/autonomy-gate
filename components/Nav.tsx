"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/config/routes";

/** Top-level navigation. A task drill-down keeps its parent section highlighted. */
export function Nav() {
  const pathname = usePathname() ?? "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/tasks");
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    // On a narrow screen the strip scrolls rather than forcing the page wider
    // than the viewport. Items stay on one line so none of them is cut in half.
    <nav
      aria-label="Primary"
      className="-mx-space-xs flex max-w-full items-center gap-space-xs overflow-x-auto px-space-xs"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "shrink-0 whitespace-nowrap rounded-lg px-space-md py-space-sm font-body-md text-body-md transition-colors",
              active
                ? "bg-surface-container-high text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
