# RevMarks Front-End Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the RevMarks front end on a shared component layer, restructured into a phone-optimised Mark mode and a desktop-friendly Manage section, without touching the database, API routes, or marks formula.

**Architecture:** A token layer (Tailwind theme + `globals.css`) feeds a small set of primitives in `app/components/ui/`. Every screen is composed from those primitives. Routing splits into `/` (Mark) and `/manage/*`, with the offline-sync engine and service-worker registration hoisted into the root layout so they run on every route.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Tailwind CSS **v3**, Neon serverless Postgres (unchanged).

**Spec:** `docs/superpowers/specs/2026-09-10-revmarks-frontend-redesign-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Tailwind is v3.** `backdrop-blur-xs`, `text-*` v4 tokens, and other v4-only class names silently do nothing. Use `backdrop-blur-sm`.
- **Do not change** the database schema, any file under `app/api/`, or `lib/calc.ts`. The formula is `(mcq + structured + essay) / (num_mcq + num_structured*5 + num_essay*7.5) * 100`.
- **Do not change** the sessionStorage key `marks_session_v2` or its `{town, revId, checkedBy}` shape. Anyone mid-session when this deploys must keep their locked session.
- **Do not change** the localStorage key `revmarks_offline_queue` or the `revmarks-queue-updated` event name.
- **Blank marks are permitted and save as `0`.** The save button is never disabled for missing marks. Only a missing session (town/rev/staff) blocks saving.
- **Preserve the Enter-key focus chain** in the marking form: name → phone → MCQ → structured → essay → save, with per-field `inputMode` and `enterKeyHint`.
- **Button label colour is `#ffffff` (pure white), not `paper`.** On the `brand-deep` fill this measures 4.67:1. Off-white `#f4f4f2` on brand measures 4.09:1 and fails WCAG AA.
- **Record edits use `PUT`** on `/api/records/[id]`. `PATCH` is not exported and returns 405.
- **Totals display as one decimal with a `%`** everywhere, via `formatTotal()`.
- **There is no test runner in this repository and none is being added.** The verification loop for every task is: `npm run lint`, `npm run build`, then drive the running app in a browser. Do not invent a `npm test` command.
- **Never run `npm run build` while `npm run dev` is running.** They share `.next/` and the dev server will start returning 500s. Stop the dev server first.
- **Work on branch `frontend-redesign`.** Commit after every task.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `lib/format.ts` | `formatTotal`, `formatMark` — single source of number formatting |
| `lib/useServiceWorker.ts` | Registers `public/sw.js`; no markup |
| `lib/useOfflineSync.ts` | Owns queue draining and online/offline state; no markup |
| `app/components/ui/Button.tsx` | All buttons |
| `app/components/ui/Field.tsx` | Label + input + hint + error, ref-forwarding |
| `app/components/ui/Select.tsx` | Styled native select |
| `app/components/ui/Card.tsx` | Panel container |
| `app/components/ui/Sheet.tsx` | Bottom sheet (mobile) / dialog (desktop) |
| `app/components/ui/Toast.tsx` | Toast provider + `useToast()` |
| `app/components/ui/EmptyState.tsx` | Empty list placeholder |
| `app/components/ui/Skeleton.tsx` | Loading placeholder |
| `app/components/ui/StatusDot.tsx` | Coloured status dot |
| `app/components/ui/index.ts` | Barrel export |
| `app/components/AppNav.tsx` | Bottom bar (phone) / top bar (desktop) |
| `app/components/OfflineIndicator.tsx` | Contextual offline display |
| `app/components/InstallPrompt.tsx` | PWA install UI only |
| `app/components/mark/SessionStart.tsx` | Town / REV / Checked-by start screen |
| `app/components/mark/MarkForm.tsx` | The entry loop |
| `app/components/mark/SessionEntriesSheet.tsx` | Full session list + edit |
| `app/components/mark/useMarkSession.ts` | Session lock state |
| `app/manage/page.tsx` | Manage hub |
| `app/manage/layout.tsx` | Manage sub-nav |
| `app/manage/records/page.tsx` + `RecordsClient.tsx` | Records browse/edit/export |
| `app/manage/rank/page.tsx` + `RankClient.tsx` | Rank PDF generation |
| `app/manage/revs/page.tsx` + `RevsClient.tsx` | REV number management |

**Modified:** `tailwind.config.js`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/add-rev/page.tsx` (→ redirect), `public/sw.js` (cache bump).

**Deleted at the end:** `app/components/AddRecordTab.tsx`, `ViewDataTab.tsx`, `RankSheetTab.tsx`, `OfflineStatusBanner.tsx`, `PWAInstallBanner.tsx`.

---

### Task 1: Design tokens

**Files:**
- Modify: `tailwind.config.js`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind colour tokens `ink surface surface-2 line paper dim faint brand brand-deep brand-hot brand-dim ok warn danger gold`; font sizes `micro label body title display`; radii `rounded-control rounded-card rounded-sheet`. CSS classes `.field`, `.field-lg`, `.field-label`, `.num` remain available so unconverted screens keep rendering.

- [ ] **Step 1: Replace the theme block in `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#050505",
        surface: "#111111",
        "surface-2": "#1a1a1a",
        panel: "#0d0d0d",
        line: "#262626",
        paper: "#f4f4f2",
        dim: "#9a9a9a",
        faint: "#6b6b6b",
        brand: "#dd390b",
        "brand-deep": "#d93708",
        "brand-hot": "#ff6b3d",
        "brand-dim": "#3a180d",
        gold: "#dd390b",
        ok: "#35c17f",
        warn: "#f5a524",
        danger: "#e5484d",
      },
      fontSize: {
        micro: ["11px", { lineHeight: "14px" }],
        label: ["12px", { lineHeight: "16px", letterSpacing: "0.02em" }],
        body: ["15px", { lineHeight: "22px" }],
        title: ["17px", { lineHeight: "24px", letterSpacing: "-0.01em" }],
        display: ["32px", { lineHeight: "36px", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        control: "12px",
        card: "18px",
        sheet: "24px",
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          "-apple-system",
          "BlinkMacSystemFont",
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      keyframes: {
        "sheet-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "sheet-up": "sheet-up 180ms cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 140ms ease-out",
      },
    },
  },
  plugins: [],
};
```

`gold` is kept as an alias of `brand` deliberately — unconverted screens still reference it and must keep rendering during the migration.

- [ ] **Step 2: Update the `@layer components` block in `app/globals.css`**

Replace the existing `.field`, `.btn-primary`, `.btn-outline`, `.btn-danger` rules with these. Keep the `@tailwind` directives, the `html, body` rule, `::selection`, the scrollbar rules and the select-arrow background-image rules exactly as they are, but change the focus ring colour and the `.field` body:

```css
@layer components {
  .field-label {
    font-size: 12px;
    letter-spacing: 0.02em;
    color: #9a9a9a;
    margin-bottom: 6px;
    display: block;
  }

  .field {
    width: 100%;
    min-height: 48px;
    background: #111111;
    border: 1px solid #262626;
    color: #f4f4f2;
    padding: 12px 14px;
    font-size: 15px;
    border-radius: 12px;
  }

  .field-lg {
    min-height: 56px;
    font-size: 17px;
  }

  .field::placeholder {
    color: #6b6b6b;
  }

  .field:disabled {
    opacity: 0.5;
  }

  .btn-primary {
    background: #d93708;
    color: #ffffff;
    font-weight: 600;
    min-height: 48px;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 15px;
    width: 100%;
    text-align: center;
  }

  .btn-primary:disabled {
    background: #3a180d;
    color: #6b6b6b;
  }

  .btn-outline {
    background: transparent;
    color: #f4f4f2;
    border: 1px solid #262626;
    min-height: 40px;
    padding: 10px 16px;
    border-radius: 12px;
    font-size: 14px;
  }

  .btn-danger {
    color: #e5484d;
    border: 1px solid #3a1f20;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }
}
```

Also update the two `select` background-image data URIs so the arrow stroke is `%239a9a9a` (was `%238c8c8c`) and the disabled arrow stays `%23444444`, and change `background-color: #0d0d0d` to `#111111` in the `select.field, select` rule so selects match the new `.field` surface.

- [ ] **Step 3: Verify the build compiles the new tokens**

Stop the dev server first if it is running.

Run: `npm run lint && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Verify `bg-surface` now renders**

Start the dev server (`npm run dev`), open `http://localhost:3000`, and confirm the "Marking Session" panel now has a visibly lighter background than the page behind it. Before this task it was invisible.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js app/globals.css
git commit -m "feat(ui): add surface, type and radius tokens

Defines the surface colour that eight bg-surface usages already
referenced but which was never in the theme, so those panels rendered
as nothing. Adds brand-deep for button fills: white on #d93708 is
4.67:1 where white on #dd390b is 4.5021:1, too close to the AA line."
```

---

### Task 2: Formatting helpers

**Files:**
- Create: `lib/format.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatTotal(total: number): string` returning e.g. `"72.4%"`; `formatMark(value: number | string | null | undefined): string` returning a trimmed numeric string.

- [ ] **Step 1: Create `lib/format.ts`**

```ts
/**
 * Single source of truth for how numbers are rendered in the UI.
 *
 * Before this existed the same total rendered three different ways:
 * ViewDataTab showed "72.3333", the live entry preview showed "72.33%",
 * and the recent-entries strip showed "72.3%".
 */

/** Render a percentage total: one decimal place, always suffixed with %. */
export function formatTotal(total: number | null | undefined): string {
  const n = Number(total ?? 0);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}

/**
 * Render a raw mark. Integers stay integers ("12", not "12.00");
 * fractional marks keep at most two decimals ("7.5").
 */
export function formatMark(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}
```

- [ ] **Step 2: Verify the helpers behave correctly**

There is no test runner, so check them directly with Node:

Run:
```bash
npx tsx -e "
import { formatTotal, formatMark } from './lib/format';
const checks: [string, string][] = [
  [formatTotal(72.3333), '72.3%'],
  [formatTotal(0), '0.0%'],
  [formatTotal(100), '100.0%'],
  [formatTotal(NaN), '0.0%'],
  [formatTotal(null), '0.0%'],
  [formatMark(12), '12'],
  [formatMark(7.5), '7.5'],
  [formatMark('0'), '0'],
  [formatMark(null), '0'],
];
let bad = 0;
for (const [got, want] of checks) {
  if (got !== want) { console.error('FAIL got', got, 'want', want); bad++; }
}
console.log(bad === 0 ? 'all format checks passed' : bad + ' FAILED');
process.exit(bad === 0 ? 0 : 1);
"
```

Expected: `all format checks passed`.

If `npx tsx` is unavailable offline, verify instead by temporarily rendering the values on a page and reading them in the browser — do not skip verification.

- [ ] **Step 3: Commit**

```bash
git add lib/format.ts
git commit -m "feat(ui): add formatTotal and formatMark helpers

ViewDataTab rendered totals as 72.3333 while the entry form rendered
the same value as 72.4%. One formatter now owns both."
```

---

### Task 3: Core primitives

**Files:**
- Create: `app/components/ui/Button.tsx`
- Create: `app/components/ui/Card.tsx`
- Create: `app/components/ui/StatusDot.tsx`
- Create: `app/components/ui/EmptyState.tsx`
- Create: `app/components/ui/Skeleton.tsx`
- Create: `app/components/ui/index.ts`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces:
  - `<Button variant?: "primary"|"secondary"|"ghost"|"danger" size?: "sm"|"md"|"lg" fullWidth?: boolean loading?: boolean />` — forwards ref to `HTMLButtonElement`, extends `ButtonHTMLAttributes`.
  - `<Card padded?: boolean className?: string />` — always renders a `<div>`. No `as` polymorphism: no task in this plan needs a different element, and unused polymorphism is surface with no caller.
  - `<StatusDot tone: "ok"|"warn"|"danger"|"idle" pulse?: boolean />`
  - `<EmptyState title: string hint?: string action?: ReactNode />`
  - `<Skeleton className?: string />`
  - Barrel re-exports all of the above.

- [ ] **Step 1: Create `app/components/ui/Button.tsx`**

```tsx
"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

// Button labels use pure #ffffff on brand-deep = 4.67:1.
// paper (#f4f4f2) on brand would be 4.09:1 and fail WCAG AA.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-deep text-white hover:bg-brand disabled:bg-brand-dim disabled:text-faint",
  secondary:
    "bg-surface-2 text-paper border border-line hover:border-dim disabled:text-faint",
  ghost: "bg-transparent text-dim hover:text-paper disabled:text-faint",
  danger:
    "bg-transparent text-danger border border-danger/40 hover:bg-danger/10 disabled:text-faint",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[36px] px-3 text-label",
  md: "min-h-[48px] px-4 text-body",
  lg: "min-h-[56px] px-5 text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    disabled,
    children,
    className = "",
    type = "button",
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-control font-semibold",
        "transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});
```

- [ ] **Step 2: Create `app/components/ui/Card.tsx`**

```tsx
import { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({
  padded = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "rounded-card border border-line bg-surface",
        padded ? "p-4" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/components/ui/StatusDot.tsx`**

```tsx
export type Tone = "ok" | "warn" | "danger" | "idle";

const TONES: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  idle: "bg-faint",
};

export function StatusDot({
  tone,
  pulse = false,
}: {
  tone: Tone;
  pulse?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-block h-2 w-2 shrink-0 rounded-full",
        TONES[tone],
        pulse ? "animate-pulse" : "",
      ].join(" ")}
    />
  );
}
```

- [ ] **Step 4: Create `app/components/ui/EmptyState.tsx`**

```tsx
import { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-4 py-10 text-center">
      <p className="text-body text-paper">{title}</p>
      {hint && <p className="text-label text-dim">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Create `app/components/ui/Skeleton.tsx`**

```tsx
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={["animate-pulse rounded-control bg-surface-2", className].join(" ")}
    />
  );
}
```

- [ ] **Step 6: Create `app/components/ui/index.ts`**

```ts
export { Button } from "./Button";
export type { ButtonProps } from "./Button";
export { Card } from "./Card";
export type { CardProps } from "./Card";
export { StatusDot } from "./StatusDot";
export type { Tone } from "./StatusDot";
export { EmptyState } from "./EmptyState";
export { Skeleton } from "./Skeleton";
```

- [ ] **Step 7: Verify**

Stop the dev server, then run: `npm run lint && npm run build`
Expected: both succeed. Nothing renders these yet, so this only proves they typecheck.

- [ ] **Step 8: Commit**

```bash
git add app/components/ui
git commit -m "feat(ui): add Button, Card, StatusDot, EmptyState, Skeleton"
```

---

### Task 4: Form primitives

**Files:**
- Create: `app/components/ui/Field.tsx`
- Create: `app/components/ui/Select.tsx`
- Modify: `app/components/ui/index.ts`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces:
  - `<Field label: string hint?: string error?: string size?: "md"|"lg" />` — forwards ref to `HTMLInputElement`, extends `InputHTMLAttributes`. Renders amber styling when `error` is set.
  - `<Select label: string options: {value: string; label: string}[] placeholder?: string />` — forwards ref to `HTMLSelectElement`, extends `SelectHTMLAttributes`.

- [ ] **Step 1: Create `app/components/ui/Field.tsx`**

```tsx
"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";

// `size` must be omitted from the native attributes before redeclaring it:
// InputHTMLAttributes already declares `size?: number`, and narrowing it to
// "md" | "lg" without the Omit is a TypeScript error under strict mode.
export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Right-aligned hint beside the label, e.g. "/50" for a max mark. */
  hint?: string;
  /** When set the field renders in a warning state and the message shows below. */
  error?: string;
  size?: "md" | "lg";
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, size = "md", className = "", id, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="field-label">
          {label}
        </label>
        {hint && <span className="num text-micro text-dim">{hint}</span>}
      </div>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={[
          "field",
          size === "lg" ? "field-lg" : "",
          error ? "!border-warn bg-warn/10 text-warn" : "",
          className,
        ].join(" ")}
        {...rest}
      />
      {error && (
        <span id={errorId} className="mt-1 text-micro font-medium text-warn">
          {error}
        </span>
      )}
    </div>
  );
});
```

- [ ] **Step 2: Create `app/components/ui/Select.tsx`**

```tsx
"use client";

import { SelectHTMLAttributes, forwardRef, useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder = "Select", className = "", id, ...rest },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="flex w-full flex-col">
      <label htmlFor={selectId} className="field-label">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        className={["field", className].join(" ")}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
});
```

The native `<select>` is kept deliberately — the OS picker is the best mobile control here, and `app/globals.css` already styles it with a custom arrow.

- [ ] **Step 3: Add both to `app/components/ui/index.ts`**

```ts
export { Field } from "./Field";
export type { FieldProps } from "./Field";
export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";
```

- [ ] **Step 4: Verify**

Stop the dev server, then run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add app/components/ui
git commit -m "feat(ui): add Field and Select primitives

Field owns the max-mark hint and the over-max warning styling that was
copy-pasted three times per screen."
```

---

### Task 5: Sheet and Toast

**Files:**
- Create: `app/components/ui/Sheet.tsx`
- Create: `app/components/ui/Toast.tsx`
- Modify: `app/components/ui/index.ts`

**Interfaces:**
- Consumes: `Button` from Task 3.
- Produces:
  - `<Sheet open: boolean onClose: () => void title: string footer?: ReactNode children />` — bottom sheet below 640px, centred dialog above. Closes on Escape and backdrop click.
  - `<ConfirmSheet open onClose onConfirm title message confirmLabel? destructive? loading? />`
  - `<ToastProvider>` and `useToast(): (message: string, tone?: "ok" | "warn" | "danger") => void`.

- [ ] **Step 1: Create `app/components/ui/Sheet.tsx`**

```tsx
"use client";

import { ReactNode, useEffect, useRef } from "react";
import { Button } from "./Button";

export function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // The latest onClose is held in a ref so it is NOT an effect dependency.
  // Callers pass inline arrows (`onClose={() => setOpen(false)}`), which have a
  // new identity every render. If onClose were in the deps below, any parent
  // re-render while the sheet is open — a keystroke in a field inside it, or
  // ConfirmSheet's own `loading` toggle — would tear down and re-run the
  // effect, restoring focus to the pre-sheet trigger and yanking it out of
  // whatever the user was typing in.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    // Prevent the page behind the sheet from scrolling.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 animate-fade-in backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex max-h-[85dvh] w-full flex-col rounded-t-sheet border border-line bg-surface-2 outline-none animate-sheet-up sm:max-w-md sm:rounded-sheet"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-title font-semibold text-paper">{title}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <div className="flex gap-2 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button
            variant={destructive ? "danger" : "primary"}
            fullWidth
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <p className="text-body text-dim">{message}</p>
    </Sheet>
  );
}
```

`ConfirmSheet` replaces the blocking `confirm()` at `ViewDataTab.tsx:105`. Blocking dialogs also freeze browser automation, so they must not come back.

- [ ] **Step 2: Create `app/components/ui/Toast.tsx`**

```tsx
"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type Tone = "ok" | "warn" | "danger";

interface ToastState {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<
  ((message: string, tone?: Tone) => void) | null
>(null);

const TONE_STYLES: Record<Tone, string> = {
  ok: "border-ok/40 bg-ok/15 text-paper",
  warn: "border-warn/40 bg-warn/15 text-paper",
  danger: "border-danger/40 bg-danger/15 text-paper",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, tone: Tone = "ok") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    nextId.current += 1;
    setToast({ id: nextId.current, message, tone });
    timerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4"
      >
        {toast && (
          <div
            key={toast.id}
            className={[
              "animate-fade-in rounded-control border px-4 py-2.5 text-label shadow-lg",
              TONE_STYLES[toast.tone],
            ].join(" ")}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
```

- [ ] **Step 3: Add both to `app/components/ui/index.ts`**

```ts
export { Sheet, ConfirmSheet } from "./Sheet";
export { ToastProvider, useToast } from "./Toast";
```

- [ ] **Step 4: Verify**

Stop the dev server, then run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add app/components/ui
git commit -m "feat(ui): add Sheet, ConfirmSheet and Toast

ConfirmSheet replaces the blocking confirm() used for record deletion."
```

---

### Task 6: Offline and PWA hooks

**Files:**
- Create: `lib/useServiceWorker.ts`
- Create: `lib/useOfflineSync.ts`
- Create: `app/components/OfflineIndicator.tsx`
- Create: `app/components/InstallPrompt.tsx`

**Interfaces:**
- Consumes: `getOfflineQueue`, `syncOfflineQueue` from `lib/offlineQueue`; `triggerHaptic` from `lib/haptics`; `usePWAInstall` from `lib/usePWAInstall`; `Button`, `Sheet`, `StatusDot` from Tasks 3 and 5.
- Produces:
  - `useServiceWorker(): void`
  - `useOfflineSync(): { mounted: boolean; isOnline: boolean; pendingCount: number; syncing: boolean; syncNow: () => Promise<void> }`
  - `<OfflineIndicator variant?: "inline" | "banner" />`
  - `<InstallPrompt />`

**Why this task exists:** `OfflineStatusBanner` currently owns queue syncing and `PWAInstallBanner` is the only thing that registers the service worker, and both are rendered *only* by `app/page.tsx`. Once Manage becomes its own route, a marker sitting on a Manage screen would stop syncing entirely. This task separates each engine from its display so Task 7 can hoist the engines into the root layout.

- [ ] **Step 1: Create `lib/useServiceWorker.ts`**

```ts
"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production, and actively unregisters any
 * existing worker in development.
 *
 * The development unregister is deliberate and must be preserved: a stale
 * worker intercepts RSC payload fetches and breaks local navigation.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "development") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        })
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
}
```

- [ ] **Step 2: Create `lib/useOfflineSync.ts`**

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOfflineQueue, syncOfflineQueue } from "@/lib/offlineQueue";
import { triggerHaptic } from "@/lib/haptics";

const POLL_MS = 15000;

export interface OfflineSyncState {
  /** False during SSR and first hydration - render nothing status-related until true. */
  mounted: boolean;
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  /**
   * How many records the last successful drain uploaded, held for 2.5s so the
   * UI can confirm it, then cleared. Without this the indicator simply vanishes
   * once the queue empties, which is indistinguishable from "nothing was ever
   * queued" — and this is the one moment a marker needs to know their offline
   * work actually reached the server.
   */
  justSynced: number | null;
  syncNow: () => Promise<void>;
}

export function useOfflineSync(): OfflineSyncState {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState<number | null>(null);

  // Held in a ref so the interval and event listeners never capture a stale
  // version of the callback.
  const syncingRef = useRef(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const { syncedCount, remainingCount } = await syncOfflineQueue();
      setPendingCount(remainingCount);
      if (syncedCount > 0) {
        triggerHaptic("success");
        setJustSynced(syncedCount);
        if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = setTimeout(() => setJustSynced(null), 2500);
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);
    setPendingCount(getOfflineQueue().length);

    const onOnline = () => {
      setIsOnline(true);
      triggerHaptic("light");
      void syncNow();
    };
    const onOffline = () => {
      setIsOnline(false);
      triggerHaptic("warning");
    };
    const onQueueUpdated = () => setPendingCount(getOfflineQueue().length);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("revmarks-queue-updated", onQueueUpdated);

    const interval = setInterval(() => {
      if (navigator.onLine && getOfflineQueue().length > 0) void syncNow();
    }, POLL_MS);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("revmarks-queue-updated", onQueueUpdated);
      clearInterval(interval);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, [syncNow]);

  return { mounted, isOnline, pendingCount, syncing, justSynced, syncNow };
}
```

- [ ] **Step 3: Create `app/components/OfflineIndicator.tsx`**

```tsx
"use client";

import { useOfflineSync } from "@/lib/useOfflineSync";
import { Button, StatusDot } from "@/app/components/ui";

/**
 * `inline` is used inside Mark mode's session bar.
 * `banner` is used on Manage routes, and renders nothing when there is
 * nothing to report.
 */
export function OfflineIndicator({
  variant = "banner",
}: {
  variant?: "inline" | "banner";
}) {
  const { mounted, isOnline, pendingCount, syncing, justSynced, syncNow } =
    useOfflineSync();

  if (!mounted) return null;
  // Stay visible while confirming a sync, otherwise the indicator vanishes the
  // instant the queue empties and the marker never learns their offline records
  // landed.
  if (isOnline && pendingCount === 0 && justSynced === null) return null;

  const confirming = justSynced !== null;
  const tone = confirming ? "ok" : "warn";
  const label = confirming
    ? `Synced ${justSynced} record${justSynced === 1 ? "" : "s"}`
    : !isOnline
      ? pendingCount > 0
        ? `Offline - ${pendingCount} saved locally`
        : "Offline - saving locally"
      : `${pendingCount} to sync`;

  if (variant === "inline") {
    return (
      <span
        className={`flex items-center gap-1.5 text-micro ${
          confirming ? "text-ok" : "text-warn"
        }`}
      >
        <StatusDot tone={tone} pulse={!confirming} />
        {label}
      </span>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-control border border-line bg-surface px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-label text-paper">
        <StatusDot tone={tone} pulse={!confirming} />
        <span className={`truncate ${confirming ? "text-ok" : ""}`}>{label}</span>
      </span>
      {isOnline && pendingCount > 0 && (
        <Button variant="secondary" size="sm" loading={syncing} onClick={syncNow}>
          Sync now
        </Button>
      )}
    </div>
  );
}
```

Note: every call to `useOfflineSync()` installs its own listeners and interval. Mount at most one `OfflineIndicator` per rendered route.

- [ ] **Step 4: Create `app/components/InstallPrompt.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePWAInstall } from "@/lib/usePWAInstall";
import { Button, Sheet } from "@/app/components/ui";

const DISMISS_KEY = "revmarks_pwa_dismissed";

export function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  useEffect(() => {
    setMounted(true);
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "true");
  }

  if (!mounted || isInstalled || dismissed) return null;
  if (!isInstallable && !isIOS) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-label font-semibold text-paper">
            Install RevMarks
          </span>
          <span className="truncate text-micro text-dim">
            Full screen, no address bar
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            onClick={isIOS ? () => setShowIOSGuide(true) : install}
          >
            {isIOS ? "How" : "Install"}
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss} aria-label="Dismiss">
            X
          </Button>
        </div>
      </div>

      <Sheet
        open={showIOSGuide}
        onClose={() => setShowIOSGuide(false)}
        title="Install on iPhone or iPad"
        footer={
          <Button fullWidth onClick={() => setShowIOSGuide(false)}>
            Got it
          </Button>
        }
      >
        <ol className="flex flex-col gap-3 text-body text-dim">
          <li>
            <strong className="text-paper">1.</strong> Tap the Share button in the
            Safari toolbar.
          </li>
          <li>
            <strong className="text-paper">2.</strong> Scroll down and choose{" "}
            <strong className="text-paper">Add to Home Screen</strong>.
          </li>
        </ol>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 5: Verify**

Stop the dev server, then run: `npm run lint && npm run build`
Expected: both succeed. The old banners still exist and still render; nothing has been swapped yet.

- [ ] **Step 6: Commit**

```bash
git add lib/useServiceWorker.ts lib/useOfflineSync.ts app/components/OfflineIndicator.tsx app/components/InstallPrompt.tsx
git commit -m "feat(pwa): split offline sync and SW registration from their banners"
```

---

### Task 7: App shell and navigation

**Files:**
- Create: `app/components/AppNav.tsx`
- Create: `app/components/ServiceWorkerHost.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `ToastProvider` (Task 5), `useServiceWorker` (Task 6), `usePathname` from `next/navigation`.
- Produces: `<AppNav />` rendering two destinations (Mark to `/`, Manage to `/manage`); the root layout provides `ToastProvider` and runs `useServiceWorker()` on every route.

**Expected intermediate state:** at the end of this task the app still renders the *old* three tabs inside the new shell, and `/manage` 404s because it does not exist until Task 11. That is intentional - the shell is verified independently of the screens.

- [ ] **Step 1: Create `app/components/AppNav.tsx`**

```tsx
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
```

On phone the bar sits at the bottom within thumb reach; from `md` up it moves to the top, where a bottom bar would be unusual.

- [ ] **Step 2: Create `app/components/ServiceWorkerHost.tsx`**

`app/layout.tsx` is a server component and cannot call a hook, so the hook needs a tiny client host:

```tsx
"use client";

import { useServiceWorker } from "@/lib/useServiceWorker";

export function ServiceWorkerHost() {
  useServiceWorker();
  return null;
}
```

- [ ] **Step 3: Rewrite the `RootLayout` function in `app/layout.tsx`**

Keep the existing `metadata` and `viewport` exports byte-for-byte. Add the three imports and replace only the component:

```tsx
import { AppNav } from "@/app/components/AppNav";
import { ServiceWorkerHost } from "@/app/components/ServiceWorkerHost";
import { ToastProvider } from "@/app/components/ui";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink text-paper font-sans antialiased">
        <ToastProvider>
          <ServiceWorkerHost />
          <div className="flex min-h-dvh flex-col">
            <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-6 pt-4">
              {children}
            </main>
            <AppNav />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Strip the old header out of `app/page.tsx`**

The page currently renders its own `<header>`, its own `max-w-2xl` wrapper and the "+ Add REV" link. The layout owns all of that now. Keep the existing `Tab` state and imports, and replace the returned JSX with:

```tsx
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
```

Remove the now-unused `Link` import. Keep importing the old banners - they are replaced in Task 10 and deleted in Task 15.

- [ ] **Step 5: Verify the shell in a browser**

Stop the dev server, run `npm run lint && npm run build`, then start `npm run dev` and check:

1. `http://localhost:3000` renders with a bottom bar showing **Mark** and **Manage**, Mark highlighted.
2. At 390px wide the bar stays pinned to the bottom of the viewport.
3. Above 768px the bar moves to the top of the page.
4. The three old tabs still switch correctly and the entry form still works.
5. Clicking **Manage** 404s. Expected at this stage.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/page.tsx app/components/AppNav.tsx app/components/ServiceWorkerHost.tsx
git commit -m "feat(nav): add app shell with Mark/Manage navigation"
```

---

### Task 8: Mark mode - session start

**Files:**
- Create: `app/components/mark/useMarkSession.ts`
- Create: `app/components/mark/SessionStart.tsx`

**Interfaces:**
- Consumes: `TOWNS` from `lib/towns`; `RevConfig` from `lib/calc`; `Button`, `Card`, `Field`, `Select` from Tasks 3 and 4; `triggerHaptic` from `lib/haptics`.
- Produces:
  - `useMarkSession(): { session: MarkSession | null; revs: RevConfig[]; currentRev: RevConfig | null; startSession: (s: MarkSession) => void; endSession: () => void; ready: boolean }`
  - `interface MarkSession { town: string; revId: string; checkedBy: string }`
  - `<SessionStart revs onStart />`

**Critical constraint:** the sessionStorage key stays `marks_session_v2` and the stored shape stays `{town, revId, checkedBy}`. Anyone mid-session when this deploys must keep their locked session.

- [ ] **Step 1: Create `app/components/mark/useMarkSession.ts`**

```ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RevConfig } from "@/lib/calc";

// Unchanged from the previous implementation on purpose - see constraint above.
const SESSION_KEY = "marks_session_v2";
const LAST_STAFF_KEY = "revmarks_last_staff";

export interface MarkSession {
  town: string;
  revId: string;
  checkedBy: string;
}

export function useMarkSession() {
  const [session, setSession] = useState<MarkSession | null>(null);
  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});

    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.town && s?.revId && s?.checkedBy) {
          setSession({
            town: s.town,
            revId: String(s.revId),
            checkedBy: s.checkedBy,
          });
        }
      }
    } catch {}

    setReady(true);
  }, []);

  const startSession = useCallback((s: MarkSession) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    // Remembered across sessions so the marker does not retype their own name.
    localStorage.setItem(LAST_STAFF_KEY, s.checkedBy);
    setSession(s);
  }, []);

  const endSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  const currentRev = useMemo(
    () => revs.find((r) => String(r.id) === session?.revId) ?? null,
    [revs, session]
  );

  return { session, revs, currentRev, startSession, endSession, ready };
}

export function getLastStaff(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LAST_STAFF_KEY) ?? "";
  } catch {
    return "";
  }
}
```

- [ ] **Step 2: Create `app/components/mark/SessionStart.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { TOWNS } from "@/lib/towns";
import type { RevConfig } from "@/lib/calc";
import { triggerHaptic } from "@/lib/haptics";
import { Button, Card, Field, Select } from "@/app/components/ui";
import { getLastStaff, type MarkSession } from "./useMarkSession";

export function SessionStart({
  revs,
  onStart,
}: {
  revs: RevConfig[];
  onStart: (session: MarkSession) => void;
}) {
  const [town, setTown] = useState("");
  const [revId, setRevId] = useState("");
  const [checkedBy, setCheckedBy] = useState("");

  useEffect(() => {
    setCheckedBy(getLastStaff());
  }, []);

  const canStart = Boolean(town && revId && checkedBy.trim());

  function start() {
    if (!canStart) return;
    triggerHaptic("light");
    onStart({ town, revId, checkedBy: checkedBy.trim() });
  }

  return (
    <Card className="flex flex-col gap-5">
      <h1 className="text-title font-semibold text-paper">Start marking</h1>

      <div className="flex flex-col">
        <span className="field-label">Town</span>
        <div className="grid grid-cols-2 gap-2">
          {TOWNS.map((t) => {
            const active = town === t;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  triggerHaptic("light");
                  setTown(t);
                }}
                className={[
                  "min-h-[48px] rounded-control border px-3 text-body transition-colors",
                  active
                    ? "border-brand bg-brand/15 font-semibold text-paper"
                    : "border-line bg-surface text-dim hover:text-paper",
                ].join(" ")}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <Select
        label="REV No."
        value={revId}
        onChange={(e) => setRevId(e.target.value)}
        options={revs.map((r) => ({ value: String(r.id), label: r.rev_no }))}
      />

      <Field
        label="Checked by"
        placeholder="Your name"
        value={checkedBy}
        enterKeyHint="go"
        onChange={(e) => setCheckedBy(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            start();
          }
        }}
      />

      <Button size="lg" fullWidth disabled={!canStart} onClick={start}>
        Start marking
      </Button>
    </Card>
  );
}
```

Town is five tappable chips rather than a dropdown because `lib/towns.ts` is a fixed five-entry list, and a dropdown costs tap-scroll-tap for something one tap can do.

- [ ] **Step 3: Verify it typechecks**

Stop the dev server, then run: `npm run lint && npm run build`
Expected: both succeed. Nothing renders `SessionStart` yet.

- [ ] **Step 4: Commit**

```bash
git add app/components/mark
git commit -m "feat(mark): add session hook and start screen

Town becomes five chips instead of a dropdown, and Checked by is
prefilled from the last marker name used."
```

---

### Task 9: Mark mode - the entry form

**Files:**
- Create: `app/components/mark/types.ts`
- Create: `app/components/mark/MarkForm.tsx`

**Interfaces:**
- Consumes: `calcTotal`, `RevConfig` from `lib/calc`; `formatTotal` from `lib/format` (Task 2); `addOfflineRecord` from `lib/offlineQueue`; `triggerHaptic` from `lib/haptics`; `Button`, `Field`, `useToast` from Tasks 3, 4 and 5; `MarkSession` from Task 8.
- Produces:
  - `interface MarkEntry { id?: number; tempId?: string; student_name: string | null; phone_no: string | null; mcq_mark: number; structured_mark: number; essay_mark: number; staff?: string | null; total: number; isOffline?: boolean }`
  - `<MarkForm session: MarkSession currentRev: RevConfig | null onSaved: (entry: MarkEntry) => void />`

- [ ] **Step 1: Create `app/components/mark/types.ts`**

```ts
export interface MarkEntry {
  /** Present once the record exists server-side. */
  id?: number;
  /** Present while the record is only in the offline queue. */
  tempId?: string;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff?: string | null;
  total: number;
  isOffline?: boolean;
}
```

- [ ] **Step 2: Create `app/components/mark/MarkForm.tsx`**

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { calcTotal, type RevConfig } from "@/lib/calc";
import { formatTotal } from "@/lib/format";
import { triggerHaptic } from "@/lib/haptics";
import { addOfflineRecord } from "@/lib/offlineQueue";
import { Button, Field, useToast } from "@/app/components/ui";
import type { MarkSession } from "./useMarkSession";
import type { MarkEntry } from "./types";

/** Blank marks are deliberately valid and store as 0 - students often omit details. */
function toNumber(value: string): number {
  if (value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function MarkForm({
  session,
  currentRev,
  onSaved,
}: {
  session: MarkSession;
  currentRev: RevConfig | null;
  onSaved: (entry: MarkEntry) => void;
}) {
  const toast = useToast();

  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");
  const [saving, setSaving] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const mcqRef = useRef<HTMLInputElement>(null);
  const structuredRef = useRef<HTMLInputElement>(null);
  const essayRef = useRef<HTMLInputElement>(null);

  const maxMcq = currentRev && Number(currentRev.num_mcq) > 0 ? Number(currentRev.num_mcq) : null;
  const maxStructured =
    currentRev && Number(currentRev.num_structured) > 0
      ? Number(currentRev.num_structured) * 5
      : null;
  const maxEssay =
    currentRev && Number(currentRev.num_essay) > 0
      ? Number(currentRev.num_essay) * 7.5
      : null;

  const overMcq = maxMcq !== null && mcq !== "" && Number(mcq) > maxMcq;
  const overStructured =
    maxStructured !== null && structured !== "" && Number(structured) > maxStructured;
  const overEssay = maxEssay !== null && essay !== "" && Number(essay) > maxEssay;
  const anyOver = overMcq || overStructured || overEssay;

  const allMarksEntered = mcq !== "" && structured !== "" && essay !== "";

  const liveTotal = useMemo(() => {
    if (!currentRev) return 0;
    return calcTotal(
      {
        mcq_mark: toNumber(mcq),
        structured_mark: toNumber(structured),
        essay_mark: toNumber(essay),
      },
      currentRev
    );
  }, [mcq, structured, essay, currentRev]);

  function resetAndRefocus() {
    setStudentName("");
    setPhone("");
    setMcq("");
    setStructured("");
    setEssay("");
    window.setTimeout(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    }, 50);
  }

  async function save() {
    if (saving) return;
    setSaving(true);

    const payload = {
      town: session.town,
      rev_id: Number(session.revId),
      staff: session.checkedBy,
      student_name: studentName.trim() || null,
      phone_no: phone.trim() || null,
      mcq_mark: toNumber(mcq),
      structured_mark: toNumber(structured),
      essay_mark: toNumber(essay),
    };
    const total = calcTotal(payload, currentRev);

    function queueOffline(message: string) {
      const queued = addOfflineRecord(payload);
      onSaved({ ...payload, tempId: queued.tempId, total, isOffline: true });
      triggerHaptic("warning");
      toast(message, "warn");
      resetAndRefocus();
    }

    if (!navigator.onLine) {
      queueOffline("Saved offline");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      const data = await res.json();
      onSaved({ ...payload, id: data.record?.id, total, isOffline: false });
      triggerHaptic("success");
      toast("Saved");
      resetAndRefocus();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      const networkDown =
        !navigator.onLine ||
        message.includes("Failed to fetch") ||
        message.includes("NetworkError");
      if (networkDown) {
        queueOffline("Connection lost - saved offline");
      } else {
        triggerHaptic("error");
        toast(message, "danger");
      }
    } finally {
      setSaving(false);
    }
  }

  function advanceOn(
    e: React.KeyboardEvent,
    next: React.RefObject<HTMLInputElement | null>
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    triggerHaptic("light");
    next.current?.focus();
    next.current?.select();
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        ref={nameRef}
        label="Student name"
        placeholder="e.g. K. Nimal Perera"
        size="lg"
        value={studentName}
        enterKeyHint="next"
        onChange={(e) => setStudentName(e.target.value)}
        onKeyDown={(e) => advanceOn(e, phoneRef)}
      />

      <Field
        ref={phoneRef}
        label="Mobile"
        placeholder="e.g. 0771234567"
        size="lg"
        inputMode="tel"
        value={phone}
        enterKeyHint="next"
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={(e) => advanceOn(e, mcqRef)}
      />

      <div className="grid grid-cols-3 gap-2">
        <Field
          ref={mcqRef}
          label="MCQ"
          hint={maxMcq !== null ? `/${maxMcq}` : undefined}
          size="lg"
          className="num"
          inputMode="decimal"
          value={mcq}
          enterKeyHint="next"
          error={overMcq ? "Over max" : undefined}
          onChange={(e) => {
            setMcq(e.target.value);
            if (maxMcq !== null && Number(e.target.value) > maxMcq) {
              triggerHaptic("warning");
            }
          }}
          onKeyDown={(e) => advanceOn(e, structuredRef)}
        />
        <Field
          ref={structuredRef}
          label="Struct"
          hint={maxStructured !== null ? `/${maxStructured}` : undefined}
          size="lg"
          className="num"
          inputMode="decimal"
          value={structured}
          enterKeyHint="next"
          error={overStructured ? "Over max" : undefined}
          onChange={(e) => {
            setStructured(e.target.value);
            if (maxStructured !== null && Number(e.target.value) > maxStructured) {
              triggerHaptic("warning");
            }
          }}
          onKeyDown={(e) => advanceOn(e, essayRef)}
        />
        <Field
          ref={essayRef}
          label="Essay"
          hint={maxEssay !== null ? `/${maxEssay}` : undefined}
          size="lg"
          className="num"
          inputMode="decimal"
          value={essay}
          enterKeyHint="done"
          error={overEssay ? "Over max" : undefined}
          onChange={(e) => {
            setEssay(e.target.value);
            if (maxEssay !== null && Number(e.target.value) > maxEssay) {
              triggerHaptic("warning");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
        />
      </div>

      <div
        className={[
          "flex flex-col items-center gap-1 rounded-card border px-4 py-5",
          allMarksEntered ? "border-brand/40 bg-brand/10" : "border-line bg-surface",
        ].join(" ")}
      >
        <span className="text-label uppercase tracking-wider text-dim">Total</span>
        <span
          className={[
            "num text-display font-semibold",
            allMarksEntered ? "text-brand-hot" : "text-dim",
          ].join(" ")}
        >
          {formatTotal(liveTotal)}
        </span>
        {anyOver && (
          <span className="text-micro font-medium text-warn">
            A mark is above its maximum - it will still be saved
          </span>
        )}
      </div>

      <Button size="lg" fullWidth loading={saving} onClick={save}>
        Save and next
      </Button>
    </div>
  );
}
```

**Deliberate behaviours, do not "fix" them:**
- `save()` is never disabled by missing marks. Blanks become `0`.
- Over-max warns but still saves.
- The total stays `dim` until all three marks are present, so `0.0%` never masquerades as a real score.

- [ ] **Step 3: Verify**

Stop the dev server, then run: `npm run lint && npm run build`
Expected: both succeed. Nothing renders `MarkForm` yet.

- [ ] **Step 4: Commit**

```bash
git add app/components/mark/types.ts app/components/mark/MarkForm.tsx
git commit -m "feat(mark): add entry form with hero total

Preserves the Enter chain and blank-as-zero saving; total stays dim
until all three marks are entered."
```

---

### Task 10: Mark mode - session list, edit, and wiring

**Files:**
- Create: `app/components/mark/SessionEntriesSheet.tsx`
- Create: `app/components/mark/MarkScreen.tsx`
- Modify: `app/page.tsx` (replace entirely)

**Interfaces:**
- Consumes: everything from Tasks 8 and 9; `updateOfflineRecord`, `getOfflineQueue` from `lib/offlineQueue`; `OfflineIndicator` from Task 6.
- Produces: `<SessionEntriesSheet open onClose entries currentRev onUpdated />`, `<MarkScreen />`. `app/page.tsx` renders `<MarkScreen />` and nothing else.

**Bug fixed here:** the old quick-edit sent `PATCH` to `/api/records/[id]`, which exports only `PUT` and `DELETE`, so it returned 405 and failed silently. This uses `PUT`.

- [ ] **Step 1: Create `app/components/mark/SessionEntriesSheet.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { calcTotal, type RevConfig } from "@/lib/calc";
import { formatTotal, formatMark } from "@/lib/format";
import { triggerHaptic } from "@/lib/haptics";
import { updateOfflineRecord } from "@/lib/offlineQueue";
import {
  Button,
  EmptyState,
  Field,
  Sheet,
  useToast,
} from "@/app/components/ui";
import type { MarkEntry } from "./types";

function toNumber(value: string): number {
  if (value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function SessionEntriesSheet({
  open,
  onClose,
  entries,
  currentRev,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  entries: MarkEntry[];
  currentRev: RevConfig | null;
  onUpdated: (entry: MarkEntry) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<MarkEntry | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  function beginEdit(entry: MarkEntry) {
    triggerHaptic("light");
    setEditing(entry);
    setName(entry.student_name ?? "");
    setPhone(entry.phone_no ?? "");
    setMcq(String(entry.mcq_mark ?? ""));
    setStructured(String(entry.structured_mark ?? ""));
    setEssay(String(entry.essay_mark ?? ""));
  }

  async function saveEdit() {
    if (!editing || saving) return;
    setSaving(true);

    const updated = {
      student_name: name.trim() || null,
      phone_no: phone.trim() || null,
      mcq_mark: toNumber(mcq),
      structured_mark: toNumber(structured),
      essay_mark: toNumber(essay),
    };
    const total = calcTotal(updated, currentRev);

    try {
      if (editing.isOffline && editing.tempId) {
        updateOfflineRecord(editing.tempId, updated);
      } else if (editing.id) {
        // PUT, not PATCH - PATCH is not exported by /api/records/[id].
        const res = await fetch(`/api/records/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!res.ok) throw new Error("Failed to update");
      }
      onUpdated({ ...editing, ...updated, total });
      triggerHaptic("success");
      toast("Updated");
      setEditing(null);
    } catch {
      triggerHaptic("error");
      toast("Could not update", "danger");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Sheet
        open={open}
        onClose={() => setEditing(null)}
        title="Edit entry"
        footer={
          <>
            <Button fullWidth loading={saving} onClick={saveEdit}>
              Save changes
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field
            label="Student name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Mobile"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2">
            <Field
              label="MCQ"
              className="num"
              inputMode="decimal"
              value={mcq}
              onChange={(e) => setMcq(e.target.value)}
            />
            <Field
              label="Struct"
              className="num"
              inputMode="decimal"
              value={structured}
              onChange={(e) => setStructured(e.target.value)}
            />
            <Field
              label="Essay"
              className="num"
              inputMode="decimal"
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
            />
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={`This session (${entries.length})`}>
      {entries.length === 0 ? (
        <EmptyState
          title="No entries yet"
          hint="Records you save appear here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <li
              key={entry.id ?? entry.tempId ?? i}
              className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 truncate text-body text-paper">
                  {entry.student_name || "No name"}
                  {entry.isOffline && (
                    <span className="shrink-0 rounded border border-warn/40 bg-warn/15 px-1.5 text-micro text-warn">
                      Offline
                    </span>
                  )}
                </span>
                <span className="num truncate text-micro text-dim">
                  {entry.phone_no || "No mobile"} - M {formatMark(entry.mcq_mark)} / S{" "}
                  {formatMark(entry.structured_mark)} / E {formatMark(entry.essay_mark)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="num text-body font-semibold text-paper">
                  {formatTotal(entry.total)}
                </span>
                <Button variant="secondary" size="sm" onClick={() => beginEdit(entry)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 2: Create `app/components/mark/MarkScreen.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { calcTotal } from "@/lib/calc";
import { formatTotal } from "@/lib/format";
import { getOfflineQueue } from "@/lib/offlineQueue";
import { Button, Card, Skeleton } from "@/app/components/ui";
import { OfflineIndicator } from "@/app/components/OfflineIndicator";
import { InstallPrompt } from "@/app/components/InstallPrompt";
import { MarkForm } from "./MarkForm";
import { SessionEntriesSheet } from "./SessionEntriesSheet";
import { SessionStart } from "./SessionStart";
import { useMarkSession } from "./useMarkSession";
import type { MarkEntry } from "./types";

export function MarkScreen() {
  const { session, revs, currentRev, startSession, endSession, ready } =
    useMarkSession();
  const [entries, setEntries] = useState<MarkEntry[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!session) return;

    const queued: MarkEntry[] = getOfflineQueue()
      .filter((q) => String(q.rev_id) === session.revId)
      .map((q) => ({
        tempId: q.tempId,
        student_name: q.student_name,
        phone_no: q.phone_no,
        mcq_mark: q.mcq_mark,
        structured_mark: q.structured_mark,
        essay_mark: q.essay_mark,
        staff: q.staff,
        total: calcTotal(q, currentRev),
        isOffline: true,
      }));

    try {
      const res = await fetch(
        `/api/records?town=${encodeURIComponent(session.town)}&rev_id=${session.revId}`
      );
      const data = await res.json();
      const saved: MarkEntry[] = (data.records || []).map((r: MarkEntry & { total: number }) => ({
        id: r.id,
        student_name: r.student_name,
        phone_no: r.phone_no,
        mcq_mark: Number(r.mcq_mark),
        structured_mark: Number(r.structured_mark),
        essay_mark: Number(r.essay_mark),
        staff: r.staff,
        total: r.total,
        isOffline: false,
      }));
      setEntries([...queued, ...saved]);
    } catch {
      setEntries(queued);
    }
  }, [session, currentRev]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  function handleSaved(entry: MarkEntry) {
    setEntries((prev) => [entry, ...prev]);
  }

  function handleUpdated(entry: MarkEntry) {
    setEntries((prev) =>
      prev.map((e) =>
        (entry.id && e.id === entry.id) ||
        (entry.tempId && e.tempId === entry.tempId)
          ? entry
          : e
      )
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <InstallPrompt />
        <SessionStart revs={revs} onStart={startSession} />
      </div>
    );
  }

  const last = entries[0];

  return (
    <div className="flex flex-col gap-4">
      <Card padded={false} className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-label font-semibold text-paper">
              {session.town} - {currentRev?.rev_no ?? `REV ${session.revId}`}
            </span>
            <span className="flex items-center gap-2 truncate text-micro text-dim">
              {session.checkedBy}
              <OfflineIndicator variant="inline" />
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={endSession}>
            Change
          </Button>
        </div>
      </Card>

      <MarkForm
        session={session}
        currentRev={currentRev}
        onSaved={handleSaved}
      />

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="flex items-center justify-between gap-3 rounded-control border border-line bg-surface px-3 py-3 text-left transition-colors hover:border-dim"
      >
        <span className="min-w-0 truncate text-label text-dim">
          {last ? (
            <>
              Last: <span className="text-paper">{last.student_name || "No name"}</span>
            </>
          ) : (
            "No entries yet this session"
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {last && (
            <span className="num text-label font-semibold text-paper">
              {formatTotal(last.total)}
            </span>
          )}
          <span className="text-micro text-brand-hot">
            View all ({entries.length})
          </span>
        </span>
      </button>

      <SessionEntriesSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        entries={entries}
        currentRev={currentRev}
        onUpdated={handleUpdated}
      />
    </div>
  );
}
```

- [ ] **Step 3: Replace `app/page.tsx` entirely**

```tsx
import { MarkScreen } from "@/app/components/mark/MarkScreen";

export default function Home() {
  return <MarkScreen />;
}
```

This removes the last import of `AddRecordTab`, `ViewDataTab`, `RankSheetTab`, `PWAInstallBanner` and `OfflineStatusBanner` from the home page. The files still exist and are deleted in Task 15.

- [ ] **Step 4: Verify the whole marking loop in a browser**

Stop the dev server, run `npm run lint && npm run build`, then start `npm run dev` and at 390px wide:

1. `http://localhost:3000` shows the start screen with five town chips, not a greyed-out form.
2. Tap a town, choose a REV, type a name, press Enter - marking starts.
3. Type a name, press Enter, type a mobile, press Enter, then three marks pressing Enter between each. The final Enter saves.
4. The total card shows dim grey until all three marks are in, then turns orange.
5. A toast reads "Saved" and focus returns to Student name with the field cleared.
6. Enter a mark above its maximum: the field turns amber, the total card warns, and saving still works.
7. Save with all marks blank: it saves, and the entry shows 0 marks.
8. Tap the last-entry strip: the session sheet opens listing entries. Edit one, save, and confirm the total updates - this is the path that used to fail silently with a 405.
9. Reload the page: the session is still locked (sessionStorage survived).
10. Press **Change**: the start screen returns with "Checked by" prefilled.
11. In DevTools set the network to Offline, save a record: it queues, shows an Offline badge and the session bar shows the offline indicator. Go back online and confirm it syncs.

- [ ] **Step 5: Commit**

```bash
git add app/components/mark app/page.tsx
git commit -m "feat(mark): rebuild marking screen on the shared component layer

Session start replaces the greyed-out form. Recent entries collapse to
one line with a sheet for the full list. Quick edit now uses PUT
instead of PATCH, which returned 405 and failed silently."
```

---

### Task 11: Manage routes and the hub

**Files:**
- Create: `app/manage/page.tsx`
- Create: `app/manage/layout.tsx`
- Create: `app/manage/records/page.tsx`
- Create: `app/manage/rank/page.tsx`
- Create: `app/manage/revs/page.tsx`
- Create: `app/manage/revs/RevsClient.tsx` (moved from `app/add-rev/page.tsx`)
- Modify: `app/add-rev/page.tsx` (becomes a redirect)

**Interfaces:**
- Consumes: `Card` (Task 3), `OfflineIndicator` (Task 6), and the existing `ViewDataTab` / `RankSheetTab` components.
- Produces: routes `/manage`, `/manage/records`, `/manage/rank`, `/manage/revs`; `/add-rev` permanently redirects to `/manage/revs`.

**Strategy:** this task creates the routing skeleton and moves the *existing* screens into it unchanged, so the app is fully working at the end of this task. Tasks 12-14 then redesign each screen in place. Do not redesign anything here.

- [ ] **Step 1: Create `app/manage/layout.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `app/manage/page.tsx`**

```tsx
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
```

- [ ] **Step 3: Create the three route files wrapping the existing screens**

`app/manage/records/page.tsx`:

```tsx
import ViewDataTab from "@/app/components/ViewDataTab";

export default function RecordsPage() {
  return <ViewDataTab />;
}
```

`app/manage/rank/page.tsx`:

```tsx
import RankSheetTab from "@/app/components/RankSheetTab";

export default function RankPage() {
  return <RankSheetTab />;
}
```

`app/manage/revs/page.tsx`:

```tsx
import RevsClient from "./RevsClient";

export default function RevsPage() {
  return <RevsClient />;
}
```

- [ ] **Step 4: Move the REV screen into `app/manage/revs/RevsClient.tsx`**

Copy the entire current contents of `app/add-rev/page.tsx` into `app/manage/revs/RevsClient.tsx`, then make three edits:

1. Rename the exported function from `AddRevPage` to `RevsClient`, keeping it a **default** export (`export default function RevsClient()`), because `app/manage/revs/page.tsx` imports it as a default.
2. Delete the `<header>` block and the `Link` import - the app shell owns navigation now.
3. Change the outer wrapper from `<div className="flex min-h-dvh flex-col">` plus its `<main>` to a single `<div className="flex flex-col gap-5">`, keeping all the inner sections unchanged.

- [ ] **Step 5: Replace `app/add-rev/page.tsx` with a redirect**

```tsx
import { redirect } from "next/navigation";

export default function AddRevRedirect() {
  redirect("/manage/revs");
}
```

The old path is kept because installed PWA shortcuts and browser bookmarks may still point at it.

- [ ] **Step 6: Verify routing**

Stop the dev server, run `npm run lint && npm run build`, then start `npm run dev` and check:

1. `/manage` lists three cards.
2. Each card opens its screen and the screen still works exactly as before.
3. `/add-rev` redirects to `/manage/revs`.
4. The Mark/Manage bar shows Manage highlighted on all `/manage/*` routes.
5. Above 768px the Manage sub-nav row appears.

- [ ] **Step 7: Commit**

```bash
git add app/manage app/add-rev
git commit -m "feat(manage): add Manage routes and hub

Existing screens moved unchanged; /add-rev now redirects to
/manage/revs so installed PWA shortcuts keep working."
```

---

### Task 12: Records screen

**Files:**
- Create: `app/manage/records/RecordsClient.tsx`
- Modify: `app/manage/records/page.tsx`

**Interfaces:**
- Consumes: `TOWNS`; `RevConfig` from `lib/calc`; `formatTotal`, `formatMark` from Task 2; `Button`, `Card`, `ConfirmSheet`, `EmptyState`, `Field`, `Select`, `Sheet`, `Skeleton`, `useToast` from Tasks 3-5.
- Produces: `<RecordsClient />` as the default export of `app/manage/records/RecordsClient.tsx`.

- [ ] **Step 1: Create `app/manage/records/RecordsClient.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOWNS } from "@/lib/towns";
import type { RevConfig } from "@/lib/calc";
import { formatMark, formatTotal } from "@/lib/format";
import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  Field,
  Select,
  Sheet,
  Skeleton,
  useToast,
} from "@/app/components/ui";

const POLL_MS = 3000;

interface Rec {
  id: number;
  town: string;
  rev_id: number;
  student_name: string | null;
  phone_no: string | null;
  mcq_mark: number;
  structured_mark: number;
  essay_mark: number;
  staff: string | null;
  updated_at: string;
  total: number;
}

type Sort = "modified" | "total_desc" | "total_asc";

export default function RecordsClient() {
  const toast = useToast();

  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [town, setTown] = useState("");
  const [revId, setRevId] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("modified");

  const [records, setRecords] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<Rec | null>(null);
  const [deleting, setDeleting] = useState<Rec | null>(null);
  const [busy, setBusy] = useState(false);

  // Polling must not clobber a record the user is currently editing.
  const editingRef = useRef(false);
  editingRef.current = editing !== null;

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  const ready = Boolean(town && revId);

  const load = useCallback(async () => {
    if (!town || !revId) {
      setRecords([]);
      return;
    }
    const params = new URLSearchParams({ town, rev_id: revId, sort });
    if (search.trim()) params.set("search", search.trim());
    try {
      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch {
      /* keep whatever is on screen */
    }
  }, [town, revId, search, sort]);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load, ready]);

  useEffect(() => {
    if (!ready) return;

    const interval = setInterval(() => {
      // Do not refetch while the tab is hidden or a record is open for editing.
      if (document.visibilityState !== "visible") return;
      if (editingRef.current) return;
      void load();
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [load, ready]);

  const stats = useMemo(() => {
    if (records.length === 0) return null;
    const totals = records.map((r) => r.total);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    return { count: records.length, avg, high: Math.max(...totals) };
  }, [records]);

  function exportSheet() {
    if (!ready) return;
    const params = new URLSearchParams({ town, rev_id: revId });
    window.location.href = `/api/records/export?${params.toString()}`;
  }

  async function saveEdit(values: Partial<Rec>) {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/records/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditing(null);
      toast("Record updated");
      await load();
    } catch {
      toast("Could not update record", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/records/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setDeleting(null);
      toast("Record deleted");
      await load();
    } catch {
      toast("Could not delete record", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-semibold text-paper">Records</h1>

      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Town"
            value={town}
            onChange={(e) => setTown(e.target.value)}
            options={TOWNS.map((t) => ({ value: t, label: t }))}
          />
          <Select
            label="REV No."
            value={revId}
            onChange={(e) => setRevId(e.target.value)}
            options={revs.map((r) => ({ value: String(r.id), label: r.rev_no }))}
          />
        </div>

        {ready && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field
                label="Search"
                placeholder="Name or mobile"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="sm:w-52">
              <Select
                label="Sort"
                placeholder="Modified"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                options={[
                  { value: "modified", label: "Modified" },
                  { value: "total_desc", label: "Total high to low" },
                  { value: "total_asc", label: "Total low to high" },
                ]}
              />
            </div>
            <Button variant="secondary" onClick={exportSheet}>
              Export xlsx
            </Button>
          </div>
        )}
      </Card>

      {!ready && (
        <EmptyState
          title="Choose a town and REV No."
          hint="Records load once both are selected."
        />
      )}

      {ready && stats && (
        <p className="num text-label text-dim">
          {stats.count} records - avg {formatTotal(stats.avg)} - high{" "}
          {formatTotal(stats.high)}
        </p>
      )}

      {ready && loading && records.length === 0 && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {ready && !loading && records.length === 0 && (
        <EmptyState
          title="No records"
          hint={search ? "No match for that search." : "Nothing marked yet for this REV."}
        />
      )}

      {/* Phone: cards */}
      {records.length > 0 && (
        <ul className="flex flex-col gap-2 md:hidden">
          {records.map((r) => (
            <li key={r.id}>
              <Card className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-body text-paper">
                    {r.student_name || "No name"}
                  </span>
                  <span className="num truncate text-micro text-dim">
                    {r.phone_no || "No mobile"}
                  </span>
                  <span className="num text-micro text-dim">
                    MCQ {formatMark(r.mcq_mark)} - Struct {formatMark(r.structured_mark)} -
                    Essay {formatMark(r.essay_mark)}
                  </span>
                  <span className="text-micro text-faint">Staff: {r.staff || "-"}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="num text-body font-semibold text-brand-hot">
                    {formatTotal(r.total)}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleting(r)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Desktop: table */}
      {records.length > 0 && (
        <div className="hidden overflow-x-auto rounded-card border border-line md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-surface">
                {["Name", "Mobile", "MCQ", "Struct", "Essay", "Total", "Staff", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-label font-semibold text-dim"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 text-body text-paper">
                    {r.student_name || "No name"}
                  </td>
                  <td className="num px-3 py-2.5 text-label text-dim">
                    {r.phone_no || "-"}
                  </td>
                  <td className="num px-3 py-2.5 text-label">{formatMark(r.mcq_mark)}</td>
                  <td className="num px-3 py-2.5 text-label">
                    {formatMark(r.structured_mark)}
                  </td>
                  <td className="num px-3 py-2.5 text-label">
                    {formatMark(r.essay_mark)}
                  </td>
                  <td className="num px-3 py-2.5 text-body font-semibold text-brand-hot">
                    {formatTotal(r.total)}
                  </td>
                  <td className="px-3 py-2.5 text-label text-dim">{r.staff || "-"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleting(r)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RecordEditSheet
          record={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete record"
        message={`Delete the record for ${
          deleting?.student_name || "this student"
        }? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={busy}
      />
    </div>
  );
}

function RecordEditSheet({
  record,
  busy,
  onClose,
  onSave,
}: {
  record: Rec;
  busy: boolean;
  onClose: () => void;
  onSave: (values: Partial<Rec>) => void;
}) {
  const [name, setName] = useState(record.student_name ?? "");
  const [phone, setPhone] = useState(record.phone_no ?? "");
  const [mcq, setMcq] = useState(String(record.mcq_mark));
  const [structured, setStructured] = useState(String(record.structured_mark));
  const [essay, setEssay] = useState(String(record.essay_mark));

  function toNumber(v: string) {
    if (v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit record"
      footer={
        <>
          <Button
            fullWidth
            loading={busy}
            onClick={() =>
              onSave({
                student_name: name.trim() || null,
                phone_no: phone.trim() || null,
                mcq_mark: toNumber(mcq),
                structured_mark: toNumber(structured),
                essay_mark: toNumber(essay),
              })
            }
          >
            Save changes
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Student name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label="Mobile"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="MCQ"
            className="num"
            inputMode="decimal"
            value={mcq}
            onChange={(e) => setMcq(e.target.value)}
          />
          <Field
            label="Struct"
            className="num"
            inputMode="decimal"
            value={structured}
            onChange={(e) => setStructured(e.target.value)}
          />
          <Field
            label="Essay"
            className="num"
            inputMode="decimal"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 2: Point the route at the new client**

`app/manage/records/page.tsx`:

```tsx
import RecordsClient from "./RecordsClient";

export default function RecordsPage() {
  return <RecordsClient />;
}
```

- [ ] **Step 3: Verify in a browser**

Stop the dev server, run `npm run lint && npm run build`, then start `npm run dev`:

1. `/manage/records` shows Town and REV selectors and an empty state until both are chosen.
2. Choose both: records load, the stat line reads `N records - avg X% - high Y%`.
3. Totals render as one decimal with a `%` - never `72.3333`.
4. Search filters without needing a tap to reveal the input.
5. At 1280px the table renders; below 768px cards render. Only one of the two is visible at a time.
6. Edit a record: the sheet opens, saving updates the row and shows a toast.
7. Delete a record: a sheet asks for confirmation - **no browser dialog appears**. Cancel leaves the record; confirming removes it.
8. Open a record for editing, wait 10 seconds, and confirm the form does not reset under you.
9. Switch to another browser tab for 10 seconds; in the Network panel confirm no requests to `/api/records` were made while hidden.
10. Export downloads an `.xlsx`.

- [ ] **Step 4: Commit**

```bash
git add app/manage/records
git commit -m "feat(manage): rebuild Records with table, sheets and paused polling

Search is always visible, the duplicate export button is gone, totals
use one format, delete uses a sheet instead of confirm(), and polling
stops while the tab is hidden or a record is being edited."
```

---

### Task 13: Rank sheet screen

**Files:**
- Create: `app/manage/rank/RankClient.tsx`
- Modify: `app/manage/rank/page.tsx`

**Interfaces:**
- Consumes: `TOWNS`; `RevConfig`; `Button`, `Card`, `Select` from Tasks 3 and 4.
- Produces: `<RankClient />` as the default export.

- [ ] **Step 1: Create `app/manage/rank/RankClient.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { TOWNS } from "@/lib/towns";
import type { RevConfig } from "@/lib/calc";
import { Button, Card, Select } from "@/app/components/ui";

export default function RankClient() {
  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [revId, setRevId] = useState("");
  const [town, setTown] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  const ready = Boolean(revId && town);
  const revLabel = revs.find((r) => String(r.id) === revId)?.rev_no ?? "";
  const townLabel = town === "ALL" ? "all towns" : town;

  function download() {
    if (!ready) return;
    setDownloading(true);
    const params = new URLSearchParams({ rev_id: revId, town });
    window.location.href = `/api/rank?${params.toString()}`;
    // The browser handles the download; re-enable shortly after handing off.
    window.setTimeout(() => setDownloading(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-semibold text-paper">Rank Sheet</h1>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="REV No."
            value={revId}
            onChange={(e) => setRevId(e.target.value)}
            options={revs.map((r) => ({ value: String(r.id), label: r.rev_no }))}
          />
          <Select
            label="Town"
            value={town}
            onChange={(e) => setTown(e.target.value)}
            options={[
              { value: "ALL", label: "All towns" },
              ...TOWNS.map((t) => ({ value: t, label: t })),
            ]}
          />
        </div>

        <p className="text-label text-dim">
          {ready
            ? `Generates a PDF ranking every student in ${townLabel} for ${revLabel}, highest total first.`
            : "Choose a REV No. and a town to generate a ranked PDF."}
        </p>

        <Button size="lg" fullWidth disabled={!ready} loading={downloading} onClick={download}>
          Download rank PDF
        </Button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Point the route at the new client**

`app/manage/rank/page.tsx`:

```tsx
import RankClient from "./RankClient";

export default function RankPage() {
  return <RankClient />;
}
```

- [ ] **Step 3: Verify**

Stop the dev server, run `npm run lint && npm run build`, then start `npm run dev`:

1. `/manage/rank` disables the button until both selectors are set.
2. The description line names the chosen REV and town.
3. Choosing "All towns" reads "all towns".
4. Downloading produces a PDF and the button shows a loading state briefly.

- [ ] **Step 4: Commit**

```bash
git add app/manage/rank
git commit -m "feat(manage): restyle rank sheet screen with loading feedback"
```

---

### Task 14: REV numbers screen

**Files:**
- Modify: `app/manage/revs/RevsClient.tsx` (rewrite)

**Interfaces:**
- Consumes: `Button`, `Card`, `Field`, `Sheet`, `EmptyState`, `useToast` from Tasks 3-5; `RevConfig` from `lib/calc`.
- Produces: `<RevsClient />` as the **default** export of `app/manage/revs/RevsClient.tsx`.

**Domain note:** the paper total (the denominator in the marks formula) is `num_mcq + num_structured * 5 + num_essay * 7.5`. Editing these counts recalculates every total for that REV across the app, so the warning must stay prominent.

- [ ] **Step 1: Rewrite `app/manage/revs/RevsClient.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type { RevConfig } from "@/lib/calc";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Sheet,
  useToast,
} from "@/app/components/ui";

function paperTotal(mcq: number, structured: number, essay: number) {
  return mcq + structured * 5 + essay * 7.5;
}

function toNumber(v: string) {
  if (v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function RevsClient() {
  const toast = useToast();
  const [revs, setRevs] = useState<RevConfig[]>([]);
  const [revNo, setRevNo] = useState("");
  const [mcq, setMcq] = useState("");
  const [structured, setStructured] = useState("");
  const [essay, setEssay] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RevConfig | null>(null);

  const load = useCallback(() => {
    fetch("/api/revs")
      .then((r) => r.json())
      .then((d) => setRevs(d.revs || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!revNo.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/revs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rev_no: revNo.trim(),
          num_mcq: toNumber(mcq),
          num_structured: toNumber(structured),
          num_essay: toNumber(essay),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setRevNo("");
      setMcq("");
      setStructured("");
      setEssay("");
      toast("REV saved");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save REV", "danger");
    } finally {
      setSaving(false);
    }
  }

  const newTotal = paperTotal(toNumber(mcq), toNumber(structured), toNumber(essay));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-title font-semibold text-paper">REV Numbers</h1>

      <Card className="flex flex-col gap-3">
        <span className="text-label font-semibold uppercase tracking-wider text-dim">
          Add a REV
        </span>

        <Field
          label="REV No."
          placeholder="e.g. REV 01"
          value={revNo}
          onChange={(e) => setRevNo(e.target.value)}
        />

        <div className="grid grid-cols-3 gap-2">
          <Field
            label="MCQs"
            className="num"
            inputMode="numeric"
            placeholder="0"
            value={mcq}
            onChange={(e) => setMcq(e.target.value)}
          />
          <Field
            label="Structured"
            className="num"
            inputMode="numeric"
            placeholder="0"
            value={structured}
            onChange={(e) => setStructured(e.target.value)}
          />
          <Field
            label="Essays"
            className="num"
            inputMode="numeric"
            placeholder="0"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
        </div>

        <p className="num text-label text-dim">
          Paper total: {newTotal.toFixed(1)} marks
        </p>

        <Button fullWidth disabled={!revNo.trim()} loading={saving} onClick={save}>
          Save REV
        </Button>
      </Card>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-label font-semibold uppercase tracking-wider text-dim">
            Configured
          </span>
          <span className="text-micro text-dim">{revs.length} total</span>
        </div>

        {revs.length === 0 ? (
          <EmptyState title="No REV numbers yet" hint="Add one above to start marking." />
        ) : (
          revs.map((r) => (
            <Card
              key={r.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-semibold text-paper">{r.rev_no}</span>
                <span className="num text-micro text-dim">
                  MCQ {r.num_mcq} - Structured {r.num_structured} - Essay {r.num_essay}
                </span>
                <span className="num text-micro text-brand-hot">
                  Paper total {paperTotal(r.num_mcq, r.num_structured, r.num_essay).toFixed(1)}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                Edit
              </Button>
            </Card>
          ))
        )}
      </div>

      {editing && (
        <RevEditSheet
          rev={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            toast("REV updated - totals recalculated");
          }}
        />
      )}
    </div>
  );
}

function RevEditSheet({
  rev,
  onClose,
  onSaved,
}: {
  rev: RevConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [revNo, setRevNo] = useState(rev.rev_no);
  const [mcq, setMcq] = useState(String(rev.num_mcq));
  const [structured, setStructured] = useState(String(rev.num_structured));
  const [essay, setEssay] = useState(String(rev.num_essay));
  const [saving, setSaving] = useState(false);

  const total = paperTotal(toNumber(mcq), toNumber(structured), toNumber(essay));

  async function save() {
    if (!revNo.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/revs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rev.id,
          rev_no: revNo.trim(),
          num_mcq: toNumber(mcq),
          num_structured: toNumber(structured),
          num_essay: toNumber(essay),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update REV", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Edit ${rev.rev_no}`}
      footer={
        <>
          <Button fullWidth disabled={!revNo.trim()} loading={saving} onClick={save}>
            Save changes
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="REV No."
          value={revNo}
          onChange={(e) => setRevNo(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="MCQs"
            className="num"
            inputMode="numeric"
            value={mcq}
            onChange={(e) => setMcq(e.target.value)}
          />
          <Field
            label="Structured"
            className="num"
            inputMode="numeric"
            value={structured}
            onChange={(e) => setStructured(e.target.value)}
          />
          <Field
            label="Essays"
            className="num"
            inputMode="numeric"
            value={essay}
            onChange={(e) => setEssay(e.target.value)}
          />
        </div>

        <p className="num text-label text-dim">Paper total: {total.toFixed(1)} marks</p>

        <div className="rounded-control border border-warn/40 bg-warn/10 p-3">
          <p className="text-label text-warn">
            Changing these counts recalculates the total mark of every student
            already recorded against {rev.rev_no}, in the app, the rank sheet and
            the Excel export.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify**

Stop the dev server, run `npm run lint && npm run build`, then start `npm run dev`:

1. `/manage/revs` lists the existing REVs with their paper totals.
2. Adding a REV clears the form and the new REV appears in the list.
3. The live "Paper total" updates as counts are typed - with 50 MCQ, 4 structured, 4 essay it reads `100.0`.
4. Editing a REV shows the amber recalculation warning inside the sheet.
5. Saving an edit shows the "totals recalculated" toast and the list refreshes.
6. `/add-rev` still redirects here.

- [ ] **Step 3: Commit**

```bash
git add app/manage/revs
git commit -m "feat(manage): rebuild REV numbers screen

Editing moves into a sheet and the recalculation warning is now a
prominent callout rather than small grey text."
```

---

### Task 15: Remove the old screens and finish

**Files:**
- Delete: `app/components/AddRecordTab.tsx`
- Delete: `app/components/ViewDataTab.tsx`
- Delete: `app/components/RankSheetTab.tsx`
- Delete: `app/components/OfflineStatusBanner.tsx`
- Delete: `app/components/PWAInstallBanner.tsx`
- Modify: `public/sw.js`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Confirm nothing imports the old components**

Run:
```bash
grep -rn "AddRecordTab\|ViewDataTab\|RankSheetTab\|OfflineStatusBanner\|PWAInstallBanner" app lib
```
Expected: no matches. If anything matches, fix that import before deleting.

- [ ] **Step 2: Delete the five files**

```bash
git rm app/components/AddRecordTab.tsx app/components/ViewDataTab.tsx app/components/RankSheetTab.tsx app/components/OfflineStatusBanner.tsx app/components/PWAInstallBanner.tsx
```

- [ ] **Step 3: Bump the service worker cache name**

In `public/sw.js` change:

```js
const CACHE_NAME = 'revmarks-cache-v2';
```

to:

```js
const CACHE_NAME = 'revmarks-cache-v3';
```

Required because the worker caches `/` for offline navigation. Without the bump, returning users can be served the old shell after deploy.

- [ ] **Step 4: Confirm no v4-only Tailwind classes remain**

Run:
```bash
grep -rn "backdrop-blur-xs\|bg-surface/[0-9]" app
```
Expected: no matches for `backdrop-blur-xs`.

- [ ] **Step 5: Update the "Known defects" section of `CLAUDE.md`**

All five listed defects are now fixed. Replace that section with a short note recording that the undefined `surface` token, the v4-only `backdrop-blur-xs`, the `PATCH`/405 mismatch and the blocking `confirm()` were resolved in the front-end redesign, and that `public/manifest.json` remains stale and unreferenced. Also update the Conventions section: shared components now live in `app/components/ui/`, and number formatting goes through `lib/format.ts`.

- [ ] **Step 6: Full verification sweep**

Stop the dev server, then run `npm run lint && npm run build`. Both must pass.

Start `npm run dev` and walk the whole app at 390px and again at 1280px:

1. Start a session, save three records including one with all marks blank.
2. Edit an entry from the session sheet.
3. `/manage/records`: filter, search, sort, edit, delete, export.
4. `/manage/rank`: download a PDF.
5. `/manage/revs`: add a REV, edit a REV.
6. `/add-rev` redirects.
7. Go offline, save a record, come back online, confirm it syncs from a Manage route as well as from Mark - this is the bug the layout hoist fixed.
8. Screenshot each screen at both widths for the review.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove superseded screens and bump SW cache

Deletes the five components replaced by the Mark/Manage rebuild and
bumps CACHE_NAME so returning users do not get the old cached shell."
```

- [ ] **Step 8: Report**

Summarise for the user: what changed, screenshots at both widths, and the parked items still outstanding (Excel placeholder values, rank preview, whether the PDF and in-app lists should show 0 for missing names).
