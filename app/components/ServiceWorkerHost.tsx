"use client";

import { useServiceWorker } from "@/lib/useServiceWorker";

export function ServiceWorkerHost() {
  useServiceWorker();
  return null;
}
