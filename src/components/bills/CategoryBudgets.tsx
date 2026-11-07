// src/components/bills/CategoryBudgets.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings2, AlertTriangle, TrendingUp, ChevronDown } from "lucide-react";
import { BILL_CATEGORIES } from "@/lib/db/schema";
import { CATEGORY_CONFIG, type SpendingCategory } from "@/lib/categories";
import { formatDateBR } from "@/lib/month";
import type { MonthSpending, SpendingLine } from "@/lib/month-spending";

type BillCategory = SpendingCategory;

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
  month: number;
  year: number;
  /** Muda quando contas/compras mudam, para recarregar o gasto do mês. */
  refreshKey?: string | number;
  defaultExpanded?: boolean;
}

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function CategoryBudgets({ month, year, refreshKey, defaultExpanded = false }: Readonly<Props>) {
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [spending, setSpending] = useState<MonthSpending | null>(null);
  const [openCategory, setOpenCategory] = useState<BillCategory | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
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

  // Gasto real do mês: contas + compras do cartão por categoria + cartões alimentação
  useEffect(() => {
    fetch(`/api/month-spending?month=${month}&year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setSpending)
      .catch(() => setSpending(null));
  }, [month, year, refreshKey]);

  const spentByCategory: Partial<Record<string, number>> = spending?.byCategory ?? {};
  const linesOf = (cat: BillCategory): SpendingLine[] =>
    (spending?.lines ?? []).filter((l) => l.category === cat).sort((a, b) => b.amount - a.amount);

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
            style={{ fontFamily: "var(--font-display)", color: "rgb(var(--text))" }}
          >
            Limites por categoria
          </h3>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            color="rgb(var(--text-soft))"
          />
        </button>
        <div>
          <p className="text-xs mt-0.5 text-right" style={{ color: "rgb(var(--text-muted))" }}>
            Acompanhe seus gastos por área
          </p>
        </div>
        <button
          onClick={editing ? saveAll : openEditing}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: editing ? "rgb(var(--text-muted))" : "rgb(var(--surface-raised))",
            color: "rgb(var(--text))",
            border: "1px solid rgb(var(--border))",
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
                  style={{ color: "rgb(var(--text-soft))" }}
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
              style={{ color: "rgb(var(--text-soft))", background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))" }}
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
                ? "rgb(var(--negative))"
                : status === "warning"
                ? "rgb(var(--warning))"
                : "rgb(var(--text-muted))";

            return (
              <div key={category} className="space-y-1.5">
                {/* Label row — toque abre as transações da categoria */}
                <button
                  type="button"
                  onClick={() => setOpenCategory((prev) => (prev === category ? null : category))}
                  aria-expanded={openCategory === category}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{cfg.emoji}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "rgb(var(--text))" }}
                    >
                      {cfg.label}
                    </span>
                    {status === "over" && (
                      <AlertTriangle size={11} color="rgb(var(--negative))" />
                    )}
                    {status === "warning" && (
                      <TrendingUp size={11} color="rgb(var(--warning))" />
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className="text-xs font-bold font-numeric"
                      style={{
                        color:
                          status === "over"
                            ? "rgb(var(--negative))"
                            : status === "warning"
                            ? "rgb(var(--warning))"
                            : "rgb(var(--text))",
                      }}
                    >
                      {BRL(spent)}
                    </span>
                    {budget !== null && (
                      <span className="text-xs ml-1" style={{ color: "rgb(var(--text-muted))" }}>
                        / {BRL(budget)}
                      </span>
                    )}
                  </div>
                </button>

                {/* Progress bar */}
                {budget === null ? (
                  // Sem limite definido: barra cinza com traço
                  <div
                    className="h-1.5 rounded-full"
                    style={{ background: "rgb(var(--border))", opacity: 0.4 }}
                  />
                ) : (
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "rgb(var(--border))" }}
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
                  <p className="text-[10px]" style={{ color: "rgb(var(--negative))" }}>
                    Ultrapassou {BRL(spent - budget)} acima do limite
                  </p>
                )}
                {status === "warning" && budget !== null && (
                  <p className="text-[10px]" style={{ color: "rgb(var(--warning))" }}>
                    {Math.round(percent)}% do limite — restam {BRL(budget - spent)}
                  </p>
                )}

                {(() => {
                  // Cada conta da categoria à vista: estourou o limite → todas; senão as 3 maiores.
                  const lines = linesOf(category);
                  const showAll = status === "over" || openCategory === category;
                  const shown = showAll ? lines : lines.slice(0, 3);
                  if (lines.length === 0) return null;
                  return (
                    <ul
                      className="mt-1 rounded-lg divide-y divide-line"
                      style={{
                        background: "rgb(var(--surface-raised))",
                        border: status === "over" ? "1px solid rgb(var(--negative) / 0.35)" : undefined,
                      }}
                    >
                      {shown.map((l, i) => (
                        <li key={`${l.source}-${i}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                          <span className="flex-1 min-w-0 truncate">{l.name}</span>
                          <span className="flex-shrink-0" style={{ color: "rgb(var(--text-muted))" }}>
                            {l.source === "conta" ? "conta" : l.origin ?? l.source}
                            {l.date ? ` · ${formatDateBR(l.date).slice(0, 5)}` : ""}
                          </span>
                          <span className="font-numeric flex-shrink-0">{BRL(l.amount)}</span>
                        </li>
                      ))}
                      {!showAll && lines.length > 3 && (
                        <li>
                          <button
                            type="button"
                            onClick={() => setOpenCategory(category)}
                            className="w-full px-3 py-1.5 text-[11px] font-semibold text-left"
                            style={{ color: "rgb(var(--accent))" }}
                          >
                            ver todas ({lines.length})
                          </button>
                        </li>
                      )}
                    </ul>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Sem dados ainda */}
      {!editing && summaries.length === 0 && (
        <p className="text-xs text-center py-2" style={{ color: "rgb(var(--text-muted))" }}>
          Lance contas, compras no cartão ou no cartão alimentação para ver os gastos por categoria.
        </p>
      )}
        </>
      )}
    </div>
  );
}
