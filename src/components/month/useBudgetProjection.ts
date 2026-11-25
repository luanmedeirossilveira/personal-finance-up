"use client";

import { useEffect, useState } from "react";
import { remainingInBudgets } from "@/lib/category-budget-shared";
import type { MonthSpending } from "@/lib/month-spending";

// Quanto ainda falta gastar nos limites do mês (sem o cartão alimentação), para o saldo projetado.
// Sem limite definido, devolve null e o box some.
export function useBudgetProjection(month: number, year: number, refreshKey: string | number) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/category-budgets?month=${month}&year=${year}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/month-spending?month=${month}&year=${year}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([budgets, spending]: [{ category: string; amount: number }[], MonthSpending | null]) => {
        if (cancelled) return;
        if (!Array.isArray(budgets) || budgets.length === 0 || !spending) {
          setRemaining(null);
          return;
        }
        setRemaining(remainingInBudgets(budgets, spending.lines, spending.meal.limit).total);
      })
      .catch(() => !cancelled && setRemaining(null));
    return () => {
      cancelled = true;
    };
  }, [month, year, refreshKey]);

  return remaining;
}
