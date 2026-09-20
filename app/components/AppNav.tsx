"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Shield, UserCheck } from "lucide-react";
import { useAuth } from "./PasswordGate";

const ADMIN_ITEMS = [
  { href: "/", label: "Mark" },
  { href: "/sessions", label: "Active Sessions" },
  { href: "/manage", label: "Manage" },
];

const MARKER_ITEMS = [
  { href: "/", label: "Mark" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname();
  const { role, lockDevice } = useAuth();

  const items = role === "marker" ? MARKER_ITEMS : ADMIN_ITEMS;

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:order-first md:top-0 md:bottom-auto md:border-b md:border-t-0 md:pb-0"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-2">
        <div className="flex flex-1 items-center">
          {items.map((item) => {
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

        {/* Role status pill and lock button */}
        <div className="hidden items-center gap-2 pr-2 sm:flex">
          {role === "admin" ? (
            <span
              id="role-indicator-badge"
              className="flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-micro font-medium text-brand"
            >
              <Shield className="h-3 w-3" />
              Admin
            </span>
          ) : (
            <span
              id="role-indicator-badge"
              className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-micro font-medium text-dim"
            >
              <UserCheck className="h-3 w-3" />
              Paper Marker
            </span>
          )}

          <button
            type="button"
            id="nav-lock-role-btn"
            onClick={() => void lockDevice()}
            title="Lock device / Switch role"
            className="flex items-center gap-1 rounded-control border border-line bg-surface px-2 py-1 text-micro text-dim transition-colors hover:border-dim hover:text-paper"
          >
            <Lock className="h-3 w-3" />
            <span>Lock</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
