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
