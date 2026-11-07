"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export default function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed:", err));
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    const prompt = installPrompt as any;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  }

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl animate-fade-in"
      style={{
        background: "rgb(var(--surface-raised))",
        border: "1px solid rgb(var(--accent-strong))",
        boxShadow: "0 8px 32px rgb(var(--accent-strong) / 0.2)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/android-chrome-192x192.png" alt="" className="w-10 h-10" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "rgb(var(--text))" }}>
            Instalar app
          </p>
          <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
            Acesso rápido na tela inicial
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowBanner(false)}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: "rgb(var(--text-muted))" }}
        >
          Agora não
        </button>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
        >
          <Download size={13} />
          Instalar
        </button>
      </div>
    </div>
  );
}
