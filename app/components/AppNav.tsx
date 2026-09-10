"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Mark" },
  { href: "/manage", label: "Manage" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:order-first md:top-0 md:bottom-auto md:border-b md:border-t-0 md:pb-0"
    >
      <div className="mx-auto flex w-full max-w-3xl">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex-1 border-t-2 py-4 text-center text-label font-semibold transition-colors",
                "md:flex-none md:border-b-2 md:border-t-0 md:px-6 md:py-3.5",
                active
                  ? "border-brand text-paper"
                  : "border-transparent text-dim hover:text-paper",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
