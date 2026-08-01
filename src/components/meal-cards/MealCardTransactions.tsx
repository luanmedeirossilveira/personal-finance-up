// src/components/meal-cards/MealCardTransactions.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import showConfirm from "@/components/ui/confirm";
import MealCardTransactionForm, { type MealTransactionItem } from "./MealCardTransactionForm";

interface MealTransaction {
  id: number;
  name: string;
  amount: number;
  category?: string | null;
  date?: string | null;
  items?: MealTransactionItem[];
}

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtQty = (q: number) =>
  Number.isInteger(q) ? String(q) : q.toLocaleString("pt-BR");

export default function MealCardTransactions({
  cardId,
  onChange,
}: Readonly<{
  cardId: number;
  onChange?: (spent: number) => void;
}>) {
  const [transactions, setTransactions] = useState<MealTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTransaction, setEditTransaction] = useState<MealTransaction | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meal-cards/${cardId}/transactions`);
      const data = res.ok ? await res.json() : [];
      const list: MealTransaction[] = Array.isArray(data) ? data : [];
      setTransactions(list);
      onChange?.(list.reduce((sum, t) => sum + t.amount, 0));
    } catch {
      setTransactions([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function handleDelete(transactionId: number) {
    const ok = await showConfirm("Remover esta compra?");
    if (!ok) return;
    await fetch(`/api/meal-cards/${cardId}/transactions/${transactionId}`, {
      method: "DELETE",
    });
    fetchTransactions();
  }

  function toggle(id: number) {
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <div className="text-xs py-3" style={{ color: "#4a6b58" }}>
        Carregando extrato...
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between py-2">
        <span
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: "#4a6b58" }}
        >
          Extrato ({transactions.length})
        </span>
        <button
          onClick={() => {
            setEditTransaction(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
          style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
        >
          <Plus size={12} />
          Adicionar compra
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-xs py-2" style={{ color: "#4a6b58" }}>
          Nenhuma compra registrada
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "#2a3d31" }}>
          {transactions.map((t) => {
            const items = t.items || [];
            const hasItems = items.length > 0;
            const isOpen = expanded.includes(t.id);
            return (
              <div key={t.id}>
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: "#f0f9f4" }}
                    >
                      {t.name}
                    </div>
                    <div
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "#4a6b58" }}
                    >
                      {t.category && <span>{t.category}</span>}
                      {t.date && (
                        <span>
                          {t.category ? "• " : ""}
                          {new Date(t.date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {hasItems && (
                        <button
                          type="button"
                          onClick={() => toggle(t.id)}
                          className="flex items-center gap-0.5"
                          style={{ color: "#5ab28d" }}
                        >
                          <Receipt size={11} />
                          {items.length} {items.length === 1 ? "item" : "itens"}
                          {isOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    className="text-sm font-bold font-numeric w-24 text-right"
                    style={{ color: "#f0f9f4" }}
                  >
                    {BRL(t.amount)}
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditTransaction(t);
                        setShowForm(true);
                      }}
                      className="p-1.5 rounded"
                      style={{ background: "#1c2b22", color: "#8dcdb0" }}
                      aria-label="Editar compra"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 rounded"
                      style={{ background: "#1c2b22", color: "#ef4444" }}
                      aria-label="Remover compra"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Itens (produtos) da compra */}
                {hasItems && isOpen && (
                  <div
                    className="pb-2 pl-1 space-y-1"
                    style={{ borderLeft: "2px solid #2a3d31", marginLeft: "2px" }}
                  >
                    {items.map((it, idx) => (
                      <div
                        key={it.id ?? `${it.name}-${idx}`}
                        className="flex items-center justify-between text-xs pl-2"
                      >
                        <span className="truncate" style={{ color: "#8dcdb0" }}>
                          {it.quantity && it.quantity !== 1 ? `${fmtQty(it.quantity)}× ` : ""}
                          {it.name}
                        </span>
                        <span className="font-numeric flex-shrink-0 ml-2" style={{ color: "#4a6b58" }}>
                          {BRL(it.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {transactions.length > 0 && (
        <div
          className="flex items-center justify-between pt-2 border-t"
          style={{ borderColor: "#2a3d31" }}
        >
          <span
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "#8dcdb0" }}
          >
            Total gasto
          </span>
          <span
            className="text-sm font-bold font-numeric"
            style={{ color: "#f0f9f4" }}
          >
            {BRL(total)}
          </span>
        </div>
      )}

      {showForm && (
        <MealCardTransactionForm
          cardId={cardId}
          transaction={editTransaction}
          onClose={() => {
            setShowForm(false);
            setEditTransaction(null);
          }}
          onSave={() => {
            setShowForm(false);
            setEditTransaction(null);
            fetchTransactions();
          }}
        />
      )}
    </div>
  );
}
