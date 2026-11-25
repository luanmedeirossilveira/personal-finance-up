// Limites por categoria (sem DB): faixa de cor e saldo projetado.
// Gastar até o limite é o planejado (verde); até 10% acima é tolerável (amarelo); além disso, estourou.
// O saldo projetado desconta o que ainda falta gastar dentro dos limites. O cartão alimentação
// conta em Alimentação na aba Categorias, mas não é dinheiro do mês: na projeção sai o gasto dele
// e o limite dos cartões alimentação sai do limite de Alimentação.
import { normalizeCategory, type SpendingCategory } from "@/lib/categories";

export type BudgetStatus = "none" | "ok" | "warning" | "over";

// Tolerância de 1 centavo: soma de valores em real não pode tirar o "no limite" do verde.
const CENT = 0.005;
export const BUDGET_TOLERANCE = 1.1;

export function budgetRatioStatus(ratio: number): Exclude<BudgetStatus, "none"> {
  if (ratio > BUDGET_TOLERANCE) return "over";
  if (ratio > 1) return "warning";
  return "ok";
}

export function budgetStatus(spent: number, budget: number | null): BudgetStatus {
  if (budget === null || budget <= 0) return "none";
  if (spent <= budget + CENT) return "ok";
  return spent <= budget * BUDGET_TOLERANCE + CENT ? "warning" : "over";
}

export interface ProjectionLine {
  source: "conta" | "cartão" | "alimentação";
  category: SpendingCategory;
  amount: number;
}

export function remainingInBudgets(
  budgets: { category: string; amount: number }[],
  lines: ProjectionLine[],
  mealLimit: number,
): { total: number; lines: { category: SpendingCategory; remaining: number }[] } {
  const cashSpent: Partial<Record<SpendingCategory, number>> = {};
  for (const l of lines) {
    if (l.source === "alimentação") continue;
    cashSpent[l.category] = (cashSpent[l.category] ?? 0) + l.amount;
  }

  const out: { category: SpendingCategory; remaining: number }[] = [];
  for (const b of budgets) {
    const category = normalizeCategory(b.category);
    const limit = category === "alimentação" ? Math.max(0, b.amount - mealLimit) : b.amount;
    const remaining = Math.max(0, limit - (cashSpent[category] ?? 0));
    if (remaining > CENT) out.push({ category, remaining });
  }
  return { total: out.reduce((s, l) => s + l.remaining, 0), lines: out };
}

export const projectBalance = (balance: number, remaining: number) => balance - remaining;
