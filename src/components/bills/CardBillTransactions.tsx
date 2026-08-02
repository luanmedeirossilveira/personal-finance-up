"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import CardTransactionForm, { type CardTransactionItem } from "./CardTransactionForm";

interface CardTransaction {
  id: number;
  name: string;
  amount: number;
  installment?: string | null;
  category?: string | null;
  date?: string | null;
  items?: CardTransactionItem[];
}

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtQty = (q: number) =>
  Number.isInteger(q) ? String(q) : q.toLocaleString("pt-BR");

export default function CardBillTransactions({
  billId,
  onTotalChange,
}: Readonly<{
  billId: number;
  onTotalChange?: (total: number) => void;
}>) {
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTransaction, setEditTransaction] = useState<CardTransaction | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bills/${billId}/transactions`);
      if (!res.ok) {
        // API retornou erro (ex: bill não é do tipo CARD ou tabela não existe)
        setTransactions([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const transactionList = Array.isArray(data) ? data : [];
      setTransactions(transactionList);

      // Calcular e notificar o total
      const total = transactionList.reduce((sum: number, t: CardTransaction) => sum + t.amount, 0);
      onTotalChange?.(total);
    } catch (e) {
      setTransactions([]);
      console.error("Erro ao buscar transações:", e);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function handleDelete(transactionId: number) {
    if (!confirm("Remover esta transação?")) return;

    await fetch(`/api/bills/${billId}/transactions/${transactionId}`, {
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
      <div className="text-sm text-gray-400 py-2">
        Carregando transações...
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Header with add button */}
      <div className="flex items-center justify-between py-2">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#4a6b58" }}>
          Transações ({transactions.length})
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
          Adicionar
        </button>
      </div>

      {/* Transactions list */}
      {transactions.length === 0 ? (
        <div className="text-sm text-gray-400 py-2">
          Nenhuma transação cadastrada
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
                    <div className="text-sm font-medium truncate" style={{ color: "#f0f9f4" }}>
                      {t.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#4a6b58" }}>
                      {t.installment && <span>{t.installment}</span>}
                      {t.category && <span>• {t.category}</span>}
                      {t.date && <span>• {new Date(t.date).toLocaleDateString("pt-BR")}</span>}
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

                  <div className="text-sm font-bold font-numeric w-24 text-right" style={{ color: "#f0f9f4" }}>
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
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1.5 rounded"
                      style={{ background: "#1c2b22", color: "#ef4444" }}
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

      {/* Total */}
      {transactions.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "#2a3d31" }}>
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8dcdb0" }}>
            Total
          </span>
          <span className="text-sm font-bold font-numeric" style={{ color: "#f0f9f4" }}>
            {BRL(total)}
          </span>
        </div>
      )}

      {/* Transaction form modal */}
      {showForm && (
        <CardTransactionForm
          billId={billId}
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
