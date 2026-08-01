// src/components/meal-cards/MealCardsManager.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import showConfirm from "@/components/ui/confirm";
import showToast from "@/components/ui/toast";
import MealCardForm from "./MealCardForm";
import MealCardTransactions from "./MealCardTransactions";

export interface MealCard {
  id: number;
  name: string;
  limitAmount: number;
  color: string | null;
  spent: number;
}

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function getPrevMonthYear(month: number, year: number) {
  if (month === 1) return { prevMonth: 12, prevYear: year - 1 };
  return { prevMonth: month - 1, prevYear: year };
}

export default function MealCardsManager({
  month,
  year,
}: Readonly<{ month: number; year: number }>) {
  const [cards, setCards] = useState<MealCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCard, setEditCard] = useState<MealCard | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [copying, setCopying] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meal-cards?month=${month}&year=${year}`);
      const data = res.ok ? await res.json() : [];
      setCards(Array.isArray(data) ? data : []);
    } catch {
      setCards([]);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  async function handleDelete(id: number) {
    const ok = await showConfirm("Remover este cartão e todo o seu extrato?");
    if (!ok) return;
    await fetch(`/api/meal-cards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  async function copyFromPreviousMonth() {
    const { prevMonth, prevYear } = getPrevMonthYear(month, year);
    setCopying(true);
    try {
      const res = await fetch(
        `/api/meal-cards?month=${prevMonth}&year=${prevYear}`,
      );
      const prev: MealCard[] = res.ok ? await res.json() : [];
      if (prev.length === 0) {
        showToast("Nenhum cartão no mês anterior para copiar.");
        return;
      }
      const existing = new Set(cards.map((c) => c.name.trim().toLowerCase()));
      const toCreate = prev.filter(
        (c) => !existing.has(c.name.trim().toLowerCase()),
      );
      if (toCreate.length === 0) {
        showToast("Todos os cartões do mês anterior já existem aqui.");
        return;
      }
      await Promise.all(
        toCreate.map((c) =>
          fetch("/api/meal-cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: c.name,
              limitAmount: c.limitAmount,
              color: c.color,
              month,
              year,
            }),
          }),
        ),
      );
      showToast(`${toCreate.length} cartão(ões) copiado(s) do mês anterior.`);
      fetchCards();
    } catch {
      showToast("Não foi possível copiar os cartões.");
    } finally {
      setCopying(false);
    }
  }

  const totalLimit = cards.reduce((s, c) => s + c.limitAmount, 0);
  const totalSpent = cards.reduce((s, c) => s + c.spent, 0);
  const totalRemaining = totalLimit - totalSpent;

  return (
    <div className="card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🍽️</span>
          <div className="min-w-0">
            <h3
              className="text-sm font-black uppercase tracking-wide"
              style={{ fontFamily: "var(--font-display)", color: "#d6e4dd" }}
            >
              Cartões Alimentação
            </h3>
            <p className="text-[11px]" style={{ color: "#7b9488" }}>
              Controle de limite e extrato — não afeta renda e contas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={copyFromPreviousMonth}
            disabled={copying}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-60"
            style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
          >
            <Copy size={13} />
            <span className="hidden sm:inline">
              {copying ? "Copiando..." : "Copiar mês anterior"}
            </span>
          </button>
          <button
            onClick={() => {
              setEditCard(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{ background: "#389671", color: "#fff" }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Novo cartão</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      {cards.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3" style={{ background: "#12201a", border: "1px solid #2a3d31" }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "#4a6b58" }}>
              Limite total
            </div>
            <div className="text-sm font-bold font-numeric" style={{ color: "#f0f9f4" }}>
              {BRL(totalLimit)}
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#12201a", border: "1px solid #2a3d31" }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "#4a6b58" }}>
              Gasto
            </div>
            <div className="text-sm font-bold font-numeric" style={{ color: "#f59e0b" }}>
              {BRL(totalSpent)}
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "#12201a", border: "1px solid #2a3d31" }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "#4a6b58" }}>
              Disponível
            </div>
            <div
              className="text-sm font-bold font-numeric"
              style={{ color: totalRemaining >= 0 ? "#5ab28d" : "#ef4444" }}
            >
              {BRL(totalRemaining)}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-xs text-center py-3" style={{ color: "#4a6b58" }}>
          Carregando...
        </p>
      ) : cards.length === 0 ? (
        <div className="text-center py-4 space-y-2">
          <p className="text-xs" style={{ color: "#4a6b58" }}>
            Nenhum cartão alimentação neste mês.
          </p>
          <button
            onClick={() => {
              setEditCard(null);
              setShowForm(true);
            }}
            className="text-xs font-medium underline"
            style={{ color: "#5ab28d" }}
          >
            Adicionar primeiro cartão
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => {
            const spent = card.spent;
            const limit = card.limitAmount;
            const remaining = limit - spent;
            const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
            const over = limit > 0 && spent > limit;
            const warn = !over && limit > 0 && spent / limit >= 0.8;
            const barColor = over
              ? "#ef4444"
              : warn
                ? "#f59e0b"
                : card.color || "#5ab28d";
            const isExpanded = expanded.includes(card.id);

            return (
              <div
                key={card.id}
                className="rounded-xl overflow-hidden"
                style={{ background: "#12201a", border: "1px solid #2a3d31" }}
              >
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: card.color || "#5ab28d" }}
                    />
                    <span
                      className="text-sm font-semibold truncate flex-1 min-w-0"
                      style={{ color: "#f0f9f4" }}
                    >
                      {card.name}
                    </span>
                    <div className="text-right flex-shrink-0">
                      <div
                        className="text-sm font-bold font-numeric"
                        style={{ color: over ? "#ef4444" : "#f0f9f4" }}
                      >
                        {BRL(spent)}
                      </div>
                      <div className="text-[11px]" style={{ color: "#4a6b58" }}>
                        de {BRL(limit)}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditCard(card);
                          setShowForm(true);
                        }}
                        className="p-1.5 rounded"
                        style={{ background: "#1c2b22", color: "#8dcdb0" }}
                        aria-label="Editar cartão"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(card.id)}
                        className="p-1.5 rounded"
                        style={{ background: "#1c2b22", color: "#ef4444" }}
                        aria-label="Remover cartão"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        onClick={() =>
                          setExpanded((p) =>
                            p.includes(card.id)
                              ? p.filter((i) => i !== card.id)
                              : [...p, card.id],
                          )
                        }
                        className="p-1.5 rounded"
                        style={{ background: "#1c2b22", color: "#8dcdb0" }}
                        aria-label="Ver extrato"
                      >
                        {isExpanded ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "#2a3d31" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, background: barColor }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span style={{ color: over ? "#ef4444" : "#7b9488" }}>
                      {over
                        ? `Ultrapassou ${BRL(spent - limit)}`
                        : `Disponível ${BRL(remaining)}`}
                    </span>
                    <span style={{ color: "#4a6b58" }}>
                      {Math.round(limit > 0 ? (spent / limit) * 100 : 0)}%
                    </span>
                  </div>
                </div>

                {/* Extrato (expandable) */}
                {isExpanded && (
                  <div
                    className="px-3 pb-3"
                    style={{ background: "#0f1a15", borderTop: "1px solid #2a3d31" }}
                  >
                    <MealCardTransactions
                      cardId={card.id}
                      onChange={(spentTotal) =>
                        setCards((prev) =>
                          prev.map((c) =>
                            c.id === card.id ? { ...c, spent: spentTotal } : c,
                          ),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <MealCardForm
          card={editCard}
          month={month}
          year={year}
          onClose={() => {
            setShowForm(false);
            setEditCard(null);
          }}
          onSave={() => {
            setShowForm(false);
            setEditCard(null);
            fetchCards();
          }}
        />
      )}
    </div>
  );
}
