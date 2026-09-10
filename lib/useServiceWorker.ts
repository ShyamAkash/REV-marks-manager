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
