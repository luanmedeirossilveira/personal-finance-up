"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import CardTransactionForm from "./CardTransactionForm";

interface CardTransaction {
  id: number;
  name: string;
  amount: number;
  installment?: string | null;
  category?: string | null;
  date?: string | null;
}

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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
      <div className="flex items-center justify-between">
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
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: "#f0f9f4" }}>
                  {t.name}
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: "#4a6b58" }}>
                  {t.installment && <span>{t.installment}</span>}
                  {t.category && <span>• {t.category}</span>}
                  {t.date && <span>• {new Date(t.date).toLocaleDateString("pt-BR")}</span>}
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
          ))}
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
