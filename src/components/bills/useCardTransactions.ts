"use client";

import { useCallback, useEffect, useState } from "react";
import showToast from "@/components/ui/toast";
import type { CardTransactionItem } from "./CardTransactionForm";

export interface CardTransaction {
  id: number;
  name: string;
  amount: number;
  installment?: string | null;
  recurring?: boolean;
  category?: string | null;
  date?: string | null;
  position?: number | null;
  checked?: boolean;
  items?: CardTransactionItem[];
}

async function errorMessage(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

// Extrato da fatura (já ordenado pela API) + conferir, excluir e salvar a ordem manual.
export function useCardTransactions(billId: number, onTotalChange?: (total: number) => void) {
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Falha ao carregar não é "fatura vazia": mostra o erro e não mexe no total da conta.
  const fetchTransactions = useCallback(async () => {
    const res = await fetch(`/api/bills/${billId}/transactions`).catch(() => null);
    if (!res?.ok) {
      setLoadError(res ? await errorMessage(res, "Não foi possível carregar as transações.") : "Sem conexão.");
      setLoading(false);
      return;
    }
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) {
      setLoadError("Não foi possível carregar as transações.");
      setLoading(false);
      return;
    }
    const list: CardTransaction[] = data;
    setLoadError(null);
    setTransactions(list);
    onTotalChange?.(list.reduce((sum, t) => sum + t.amount, 0));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Otimista: marca na hora e desfaz se a API recusar (ex.: mês fechado).
  async function toggleChecked(t: CardTransaction) {
    const checked = !t.checked;
    setTransactions((prev) => prev.map((x) => (x.id === t.id ? { ...x, checked } : x)));
    const res = await fetch(`/api/bills/${billId}/transactions/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    }).catch(() => null);
    if (!res?.ok) {
      setTransactions((prev) => prev.map((x) => (x.id === t.id ? { ...x, checked: !checked } : x)));
      showToast(res ? await errorMessage(res, "Não foi possível conferir.") : "Sem conexão.");
    }
  }

  async function deleteTransaction(id: number) {
    const res = await fetch(`/api/bills/${billId}/transactions/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      showToast(res ? await errorMessage(res, "Não foi possível remover.") : "Sem conexão.");
      return;
    }
    fetchTransactions();
  }

  // `ids` vazio volta para a ordem por data.
  async function saveOrder(ids: number[]) {
    const res = await fetch(`/api/bills/${billId}/transactions/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => null);
    if (!res?.ok) {
      showToast(res ? await errorMessage(res, "Não foi possível salvar a ordem.") : "Sem conexão.");
      return false;
    }
    await fetchTransactions();
    return true;
  }

  return { transactions, loading, loadError, fetchTransactions, toggleChecked, deleteTransaction, saveOrder };
}
