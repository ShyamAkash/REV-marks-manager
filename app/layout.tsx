import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppNav } from "@/app/components/AppNav";
import { OfflineSyncProvider } from "@/app/components/OfflineSyncProvider";
import { PasswordGate } from "@/app/components/PasswordGate";
import { ServiceWorkerHost } from "@/app/components/ServiceWorkerHost";
import { ToastProvider } from "@/app/components/ui";

export const metadata: Metadata = {
  title: "RevMarks",
  description: "Paper marks record, rank sheet generation, and data export system for exam revisions",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RevMarks",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#050505",
};

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
          {/* Queue draining runs app-wide, not only on screens that show an
              indicator - see OfflineSyncProvider. */}
          <OfflineSyncProvider>
            <PasswordGate>
              <div className="flex min-h-dvh flex-col">
                <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-6 pt-4">
                  {children}
                </main>
                <AppNav />
              </div>
            </PasswordGate>
          </OfflineSyncProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
