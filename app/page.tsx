"use client";

import { useState } from "react";
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
    <div className="flex flex-col gap-4">
      <nav className="flex border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-2 py-3 text-label transition-colors ${
              tab === t.id
                ? "border-brand text-paper"
                : "border-transparent text-dim"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <PWAInstallBanner />
      <OfflineStatusBanner />

      {tab === "add" && <AddRecordTab />}
      {tab === "view" && <ViewDataTab />}
      {tab === "rank" && <RankSheetTab />}
    </div>
  );
}
