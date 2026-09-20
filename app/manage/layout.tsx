"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { OfflineIndicator } from "@/app/components/OfflineIndicator";
import { useAuth } from "@/app/components/PasswordGate";
import { Button, Card } from "@/app/components/ui";

const SECTIONS = [
  { href: "/manage/records", label: "Records" },
  { href: "/manage/students", label: "Students" },
  { href: "/manage/rank", label: "Rank Sheet" },
  { href: "/manage/revs", label: "REV Numbers" },
];

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = useAuth();

  if (role === "marker") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-warn/40 bg-warn/10 text-warn">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-title font-semibold text-paper">Access Restricted</h2>
          <p className="mt-2 text-label text-dim">
            You are currently signed in with the <strong>Paper Marking</strong> role. Management features and records are restricted to administrators.
          </p>
          <div className="mt-6">
            <Link href="/">
              <Button fullWidth variant="primary">
                Go to Mark Tab
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <OfflineIndicator variant="banner" />

      {/* Desktop sub-nav. On phone the hub page is the navigation. */}
      <nav aria-label="Manage sections" className="hidden gap-1 md:flex">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-control px-3 py-2 text-label text-dim transition-colors hover:bg-surface hover:text-paper"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
