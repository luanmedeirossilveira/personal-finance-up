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
        background: "#1c2b22",
        border: "1px solid #389671",
        boxShadow: "0 8px 32px rgba(56,150,113,0.2)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192x192.png" alt="Logo" className="w-10 h-10 rounded-xl" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#f0f9f4" }}>
            Instalar app
          </p>
          <p className="text-xs" style={{ color: "#4a6b58" }}>
            Acesso rápido na tela inicial
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowBanner(false)}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: "#4a6b58" }}
        >
          Agora não
        </button>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "#389671", color: "#fff" }}
        >
          <Download size={13} />
          Instalar
        </button>
      </div>
    </div>
  );
}
