// src/components/bills/CategoryBudgets.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings2, AlertTriangle, TrendingUp, ChevronDown } from "lucide-react";
import { BILL_CATEGORIES, type BillCategory } from "@/lib/db/schema";
import type { Bill } from "./BillsManager";

const CATEGORY_CONFIG: Record<
  BillCategory,
  { label: string; emoji: string }
> = {
  moradia:      { label: "Moradia",      emoji: "🏠" },
  transporte:   { label: "Transporte",   emoji: "🚗" },
  saude:        { label: "Saúde",        emoji: "❤️" },
  lazer:        { label: "Lazer",        emoji: "🎉" },
  investimentos:{ label: "Investimentos",emoji: "📈" },
  alimentação:  { label: "Alimentação",  emoji: "🍽️" },
  cartão:       { label: "Cartão",       emoji: "💳" },
  assinaturas:  { label: "Assinaturas",  emoji: "📺" },
  vestuário:    { label: "Vestuário",    emoji: "👗" },
  beleza:       { label: "Beleza",       emoji: "💄" },
  dívidas:      { label: "Dívidas",      emoji: "💸" },
  outros:       { label: "Outros",       emoji: "📦" },
};

interface CategoryBudget {
  id: number;
  category: string;
  amount: number;
}

interface CategorySummary {
  category: BillCategory;
  spent: number;
  budget: number | null;
  percent: number;
  status: "ok" | "warning" | "over";
}

interface Props {
  bills: Bill[];
  month: number;
  year: number;
}

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function CategoryBudgets({ bills, month, year }: Readonly<Props>) {
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Carrega limites do mês
  const fetchBudgets = useCallback(async () => {
    const res = await fetch(`/api/category-budgets?month=${month}&year=${year}`);
    const data = await res.json();
    setBudgets(data);
  }, [month, year]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // Calcula gasto real por categoria a partir das bills recebidas
  const spentByCategory = BILL_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = bills
      .filter((b) => b.category === cat)
      .reduce((s, b) => s + b.amount, 0);
    return acc;
  }, {});

  // Monta sumário apenas para categorias com gasto OU com limite definido
  const summaries: CategorySummary[] = BILL_CATEGORIES.map((cat) => {
    const spent = spentByCategory[cat] ?? 0;
    const budgetEntry = budgets.find((b) => b.category === cat);
    const budget = budgetEntry?.amount ?? null;
    const percent = budget ? Math.min((spent / budget) * 100, 100) : 0;
    const status: CategorySummary["status"] =
      budget === null
        ? "ok"
        : spent > budget
        ? "over"
        : spent / budget >= 0.8
        ? "warning"
        : "ok";
    return { category: cat, spent, budget, percent, status };
  }).filter((s) => s.spent > 0 || s.budget !== null);

  // ─── Edição de limites ──────────────────────────────────────────────────────
  function openEditing() {
    const initial: Record<string, string> = {};
    BILL_CATEGORIES.forEach((cat) => {
      const b = budgets.find((x) => x.category === cat);
      initial[cat] = b ? b.amount.toString() : "";
    });
    setEditValues(initial);
    setExpanded(true);
    setEditing(true);
  }

  async function saveAll() {
    setSaving(true);
    const promises = BILL_CATEGORIES.map(async (cat) => {
      const raw = editValues[cat]?.replace(",", ".").trim();
      if (!raw) return; // sem valor = sem limite
      const amount = Number.parseFloat(raw);
      if (Number.isNaN(amount) || amount <= 0) return;
      await fetch("/api/category-budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, amount, month, year }),
      });
    });
    await Promise.all(promises);
    await fetchBudgets();
    setSaving(false);
    setEditing(false);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <h3
            className="text-sm font-black uppercase tracking-wide"
            style={{ fontFamily: "var(--font-display)", color: "#d6e4dd" }}
          >
            Limites por categoria
          </h3>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            color="#9db3a8"
          />
        </button>
        <div>
          <p className="text-xs mt-0.5 text-right" style={{ color: "#7b9488" }}>
            Acompanhe seus gastos por área
          </p>
        </div>
        <button
          onClick={editing ? saveAll : openEditing}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: editing ? "#4f5f56" : "#1f2522",
            color: "#d6e4dd",
            border: "1px solid #313a36",
          }}
        >
          <Settings2 size={13} />
          {saving ? "Salvando..." : editing ? "Salvar limites" : "Definir limites"}
        </button>
      </div>

      {expanded && (
        <>
      {/* Edit mode: grid de inputs */}
      {editing && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          {BILL_CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <div key={cat}>
                <label
                  className="block text-[10px] font-semibold mb-1 uppercase tracking-wide"
                  style={{ color: "#a8bbb1" }}
                >
                  {cfg.emoji} {cfg.label}
                </label>
                <input
                  value={editValues[cat] ?? ""}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, [cat]: e.target.value }))
                  }
                  className="input-base"
                  style={{ fontSize: "13px", padding: "8px 12px" }}
                  placeholder="Sem limite"
                />
              </div>
            );
          })}
          <div className="col-span-2 flex justify-end">
            <button
              onClick={() => setEditing(false)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ color: "#a8bbb1", background: "#1f2522", border: "1px solid #313a36" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Progress bars */}
      {!editing && summaries.length > 0 && (
        <div className="space-y-3">
          {summaries.map(({ category, spent, budget, percent, status }) => {
            const cfg = CATEGORY_CONFIG[category];
            const barColor =
              status === "over"
                ? "#ef4444"
                : status === "warning"
                ? "#f59e0b"
                : "#5b7468";

            return (
              <div key={category} className="space-y-1.5">
                {/* Label row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{cfg.emoji}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "#d6e4dd" }}
                    >
                      {cfg.label}
                    </span>
                    {status === "over" && (
                      <AlertTriangle size={11} color="#ef4444" />
                    )}
                    {status === "warning" && (
                      <TrendingUp size={11} color="#f59e0b" />
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className="text-xs font-bold font-numeric"
                      style={{
                        color:
                          status === "over"
                            ? "#ef4444"
                            : status === "warning"
                            ? "#f59e0b"
                            : "#f0f9f4",
                      }}
                    >
                      {BRL(spent)}
                    </span>
                    {budget !== null && (
                      <span className="text-xs ml-1" style={{ color: "#4a6b58" }}>
                        / {BRL(budget)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {budget === null ? (
                  // Sem limite definido: barra cinza com traço
                  <div
                    className="h-1.5 rounded-full"
                    style={{ background: "#2a3d31", opacity: 0.4 }}
                  />
                ) : (
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "#2a3d31" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                        background: barColor,
                        opacity: 0.9,
                      }}
                    />
                  </div>
                )}

                {/* Status message */}
                {status === "over" && budget !== null && (
                  <p className="text-[10px]" style={{ color: "#ef4444" }}>
                    Ultrapassou {BRL(spent - budget)} acima do limite
                  </p>
                )}
                {status === "warning" && budget !== null && (
                  <p className="text-[10px]" style={{ color: "#f59e0b" }}>
                    {Math.round(percent)}% do limite — restam {BRL(budget - spent)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sem dados ainda */}
      {!editing && summaries.length === 0 && (
        <p className="text-xs text-center py-2" style={{ color: "#4a6b58" }}>
          Adicione contas com categoria para ver os limites.
        </p>
      )}
        </>
      )}
    </div>
  );
}
