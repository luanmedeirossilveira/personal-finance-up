"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Tema do sistema", light: "Tema claro", dark: "Tema escuro" };
const ICON = { system: Monitor, light: Sun, dark: Moon };

function readTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

// Alterna sistema → claro → escuro. O script inline do layout aplica a escolha antes da pintura.
export default function ThemeToggle({ compact = false }: Readonly<{ compact?: boolean }>) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => setTheme(readTheme()), []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // sem storage: vale só para esta aba
    }
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
  }

  const Icon = ICON[theme];

  if (compact) {
    return (
      <button onClick={cycle} aria-label={LABEL[theme]} title={LABEL[theme]} className="p-2 rounded-lg" style={{ color: "rgb(var(--text-soft))" }}>
        <Icon size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl w-full text-sm font-medium transition-colors hover:bg-fg/5"
      style={{ color: "rgb(var(--text-muted))" }}
    >
      <Icon size={18} />
      {LABEL[theme]}
    </button>
  );
}
