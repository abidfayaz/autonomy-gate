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
    <nav aria-label="Primary" className="flex items-center gap-space-xs">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-lg px-space-md py-space-sm font-body-md text-body-md transition-colors",
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
