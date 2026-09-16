import Link from "next/link";
import { EmptyState } from "@/app/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="py-12">
      <EmptyState
        title="Page not found"
        hint="The page you are looking for does not exist or has moved."
        action={
          <Link
            href="/"
            className="inline-flex items-center rounded-control bg-brand-deep px-4 py-2 text-label font-semibold text-white hover:bg-brand"
          >
            Return to Home
          </Link>
        }
      />
    </div>
  );
}
