import Link from "next/link";

const SECTIONS = [
  {
    href: "/manage/records",
    label: "Records",
    hint: "Browse, edit and export marks",
  },
  {
    href: "/manage/rank",
    label: "Rank Sheet",
    hint: "Generate a ranked PDF",
  },
  {
    href: "/manage/revs",
    label: "REV Numbers",
    hint: "Add or edit paper structures",
  },
];

export default function ManagePage() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-title font-semibold text-paper">Manage</h1>
      {SECTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-dim"
        >
          <span className="flex flex-col">
            <span className="text-body font-semibold text-paper">{s.label}</span>
            <span className="text-label text-dim">{s.hint}</span>
          </span>
          <span aria-hidden="true" className="text-brand-hot">
            &rarr;
          </span>
        </Link>
      ))}
    </div>
  );
}
