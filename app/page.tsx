"use client";

import { useState } from "react";
import Link from "next/link";
import AddRecordTab from "@/app/components/AddRecordTab";
import ViewDataTab from "@/app/components/ViewDataTab";
import RankSheetTab from "@/app/components/RankSheetTab";
import { PWAInstallBanner } from "@/app/components/PWAInstallBanner";
import { OfflineStatusBanner } from "@/app/components/OfflineStatusBanner";

type Tab = "add" | "view" | "rank";

const TABS: { id: Tab; label: string }[] = [
  { id: "add", label: "Add Record" },
  { id: "view", label: "View Data" },
  { id: "rank", label: "Rank Sheet" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("add");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ink">
        <div className="w-full max-w-2xl mx-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold tracking-wide">
              <span className="text-gold">Rev</span>
              <span className="text-paper">Marks</span>
            </span>
            <Link href="/add-rev" className="btn-outline text-xs px-3 py-2">
              + Add REV
            </Link>
          </div>
          <nav className="flex">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-[13px] border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-gold text-paper"
                    : "border-transparent text-dim"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="w-full max-w-2xl mx-auto flex flex-col gap-1">
        <PWAInstallBanner />
        <OfflineStatusBanner />
      </div>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 md:py-6">
        {tab === "add" && <AddRecordTab />}
        {tab === "view" && <ViewDataTab />}
        {tab === "rank" && <RankSheetTab />}
      </main>
    </div>
  );
}
