import Link from "next/link";
import { OfflineIndicator } from "@/app/components/OfflineIndicator";

const SECTIONS = [
  { href: "/manage/records", label: "Records" },
  { href: "/manage/rank", label: "Rank Sheet" },
  { href: "/manage/revs", label: "REV Numbers" },
];

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
