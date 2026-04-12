// src/components/dashboard/RiskAlerts.tsx
"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  AlertOctagon,
  X,
  TrendingUp,
  CreditCard,
  Package,
} from "lucide-react";
import type { RiskAlertType, RiskSeverity } from "@/lib/db/schema";

interface RiskAlert {
  id: number;
  type: RiskAlertType;
  severity: RiskSeverity;
  title: string;
  message: string;
  month: number;
  year: number;
}

// ─── Configuração visual por tipo ─────────────────────────────────────────────
const TYPE_CONFIG: Record<
  RiskAlertType,
  { icon: React.FC<{ size: number; color: string }>; label: string }
> = {
  installments_growth: {
    icon: ({ size, color }) => <Package size={size} color={color} />,
    label: "Parcelamentos",
  },
  fixed_growth: {
    icon: ({ size, color }) => <TrendingUp size={size} color={color} />,
    label: "Despesas Fixas",
  },
  card_recurrence: {
    icon: ({ size, color }) => <CreditCard size={size} color={color} />,
    label: "Cartão",
  },
};

const SEVERITY_CONFIG: Record<
  RiskSeverity,
  {
    border: string;
    bg: string;
    iconColor: string;
    tagBg: string;
    tagColor: string;
    label: string;
    Icon: React.FC<{ size: number; color: string }>;
  }
> = {
  danger: {
    border: "#7f1d1d",
    bg: "#1f0d0d",
    iconColor: "#ef4444",
    tagBg: "rgba(239,68,68,0.15)",
    tagColor: "#ef4444",
    label: "Crítico",
    Icon: ({ size, color }) => <AlertOctagon size={size} color={color} />,
  },
  warning: {
    border: "#78350f",
    bg: "#1c1208",
    iconColor: "#f59e0b",
    tagBg: "rgba(245,158,11,0.12)",
    tagColor: "#f59e0b",
    label: "Atenção",
    Icon: ({ size, color }) => <AlertTriangle size={size} color={color} />,
  },
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function RiskAlerts() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/risk-alerts")
      .then((r) => r.json())
      .then((data) => {
        setAlerts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function dismiss(id: number) {
    setDismissing(id);
    await fetch("/api/risk-alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setDismissing(null);
  }

  if (loading || alerts.length === 0) return null;

  const dangerAlerts = alerts.filter((a) => a.severity === "danger");
  const warningAlerts = alerts.filter((a) => a.severity === "warning");
  // Danger primeiro
  const sorted = [...dangerAlerts, ...warningAlerts];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertTriangle size={15} color="#f59e0b" />
        <h3
          className="text-sm font-black uppercase tracking-wide"
          style={{ fontFamily: "var(--font-display)", color: "#8dcdb0" }}
        >
          Alertas de comportamento
        </h3>
        {dangerAlerts.length > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
          >
            {dangerAlerts.length} crítico{dangerAlerts.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Alert cards */}
      {sorted.map((alert) => {
        const sev = SEVERITY_CONFIG[alert.severity];
        const typ = TYPE_CONFIG[alert.type];
        const TypeIcon = typ.icon;

        return (
          <div
            key={alert.id}
            className="rounded-xl p-4 transition-all"
            style={{
              background: sev.bg,
              border: `1px solid ${sev.border}`,
            }}
          >
            {/* Top row */}
            <div className="flex items-start gap-3">
              {/* Severity icon */}
              <div className="flex-shrink-0 mt-0.5">
                <sev.Icon size={18} color={sev.iconColor} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "#f0f9f4" }}
                  >
                    {alert.title}
                  </span>
                  {/* Type tag */}
                  <span
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "#1c2b22", color: "#4a6b58" }}
                  >
                    <TypeIcon size={10} color="#4a6b58" />
                    {typ.label}
                  </span>
                  {/* Severity tag */}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: sev.tagBg, color: sev.tagColor }}
                  >
                    {sev.label}
                  </span>
                </div>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#8dcdb0" }}
                >
                  {alert.message}
                </p>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => dismiss(alert.id)}
                disabled={dismissing === alert.id}
                className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-white/10 disabled:opacity-40"
                style={{ color: "#4a6b58" }}
                title="Dispensar alerta"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}

      {/* Footer hint */}
      <p className="text-[11px] text-right" style={{ color: "#2a3d31" }}>
        Alertas baseados na comparação com o mês anterior · Clique em ✕ para
        dispensar
      </p>
    </div>
  );
}
