"use client";

// Abas em pílula — usadas em Mês, Patrimônio e Revisão.
export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: Readonly<{
  tabs: { value: T; label: string; count?: number }[];
  active: T;
  onChange: (value: T) => void;
}>) {
  return (
    <div
      role="tablist"
      className="flex gap-1 p-1 rounded-xl overflow-x-auto"
      style={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))" }}
    >
      {tabs.map((t) => {
        const isActive = t.value === active;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.value)}
            className="flex-1 min-w-fit px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all"
            style={{
              background: isActive ? "rgb(var(--surface))" : "transparent",
              color: isActive ? "rgb(var(--text))" : "rgb(var(--text-muted))",
              boxShadow: isActive ? "var(--shadow)" : "none",
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-xs tabular" style={{ color: "rgb(var(--text-muted))" }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
