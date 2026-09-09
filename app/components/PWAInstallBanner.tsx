"use client";

import { useEffect, useState } from "react";
import { usePWAInstall } from "@/lib/usePWAInstall";

export function PWAInstallBanner() {
  const [mounted, setMounted] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Manage service worker registration
  useEffect(() => {
    setMounted(true);

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        // In local/container development, unregister any active service worker to avoid RSC payload fetch interference
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            for (const registration of registrations) {
              registration.unregister();
            }
          })
          .catch(() => {});
      } else {
        navigator.serviceWorker
          .register("/sw.js")
          .catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("revmarks_pwa_dismissed") === "true";
      setDismissed(isDismissed);
    }
  }, []);

  function handleDismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("revmarks_pwa_dismissed", "true");
    }
  }

  // Prevent SSR hydration mismatch
  if (!mounted) {
    return null;
  }

  // If already installed or dismissed, do not render banner
  if (isInstalled || dismissed) {
    return null;
  }

  // Only show if installable on Chrome/Android/Desktop, or if on iOS Safari
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <div className="mx-4 mt-3 p-3 rounded-xl border border-line bg-surface/90 backdrop-blur-sm flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-black border border-line flex items-center justify-center font-black text-xs shrink-0 tracking-tighter select-none">
            <span className="text-gold">R</span>
            <span className="text-white">M</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-paper truncate">
              Install RevMarks App
            </span>
            <span className="text-dim text-[11px] truncate">
              Full-screen marking · Hides address bar
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isInstallable && (
            <button
              onClick={install}
              className="btn-primary text-xs !py-1.5 !px-3 font-medium whitespace-nowrap"
            >
              Install
            </button>
          )}

          {isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="btn-primary text-xs !py-1.5 !px-3 font-medium whitespace-nowrap"
            >
              Add to Home Screen
            </button>
          )}

          <button
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="text-dim hover:text-paper p-1 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-line p-5 shadow-2xl text-paper">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Install on iPhone / iPad</h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-dim hover:text-paper p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-dim mb-4 leading-relaxed">
              Open RevMarks in full-screen standalone mode without Safari address bars:
            </p>
            <div className="flex flex-col gap-3 text-xs bg-ink/70 border border-line/60 rounded-xl p-3 mb-4">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold text-[11px] shrink-0">
                  1
                </span>
                <span>
                  Tap the <strong className="text-paper">Share</strong> button (
                  <span className="text-gold">↑</span> box with arrow) in the bottom Safari toolbar.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold text-[11px] shrink-0">
                  2
                </span>
                <span>
                  Scroll down and select <strong className="text-paper">Add to Home Screen</strong> (+).
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="btn-outline w-full text-xs py-2"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
