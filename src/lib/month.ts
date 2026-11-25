// Helpers compartilhados pelas telas Hoje e Mês.
import { budgetRatioStatus } from "@/lib/category-budget-shared";

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Evita bug de fuso horário: "YYYY-MM-DD" formatado sem passar por Date/UTC.
export function formatDateBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function todayISO(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getNextMonthYear(month: number, year: number) {
  if (month === 12) return { nextMonth: 1, nextYear: year + 1 };
  return { nextMonth: month + 1, nextYear: year };
}

// As contas são lançadas no mês seguinte ao de referência, por isso o Mês abre no próximo.
export function getDefaultPeriod(date: Date) {
  const next = getNextMonthYear(date.getMonth() + 1, date.getFullYear());
  return { month: next.nextMonth, year: next.nextYear };
}

export function incrementInstallment(installment?: string) {
  const normalized = (installment || "").trim();
  if (!normalized) return null;

  const installmentRegex = /^(\d+)\s*\/\s*(\d+)$/;
  const match = installmentRegex.exec(normalized);
  if (!match) return normalized;

  const current = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (!Number.isFinite(current) || !Number.isFinite(total) || current >= total) {
    return null;
  }

  return `${current + 1}/${total}`;
}

export function incrementStrictInstallment(installment?: string | null) {
  const normalized = (installment || "").trim();
  if (!normalized) return null;

  const installmentRegex = /^(\d+)\s*\/\s*(\d+)$/;
  const match = installmentRegex.exec(normalized);
  if (!match) return null;

  const current = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (!Number.isFinite(current) || !Number.isFinite(total) || current >= total) {
    return null;
  }

  return `${current + 1}/${total}`;
}

// Cor do anel/barra por status: verde até 100% (gastar o limite é o planejado),
// âmbar até 10% acima, vermelho além disso. Mesma faixa dos limites por categoria.
export function statusColor(ratio: number) {
  const status = budgetRatioStatus(ratio);
  if (status === "over") return "rgb(var(--negative))";
  if (status === "warning") return "rgb(var(--warning))";
  return "rgb(var(--accent))";
}

export interface MonthSummary {
  income: number;
  /** Saídas sem os aportes (categoria investimentos), como no cabeçalho do Mês. */
  outflow: number;
  invested: number;
  pending: number;
  pendingCount: number;
  /** Saldo previsto: entradas − saídas − investido. */
  balance: number;
}

// Mesma conta do cabeçalho do Mês e do "Saldo projetado" do Hoje.
export function summarizeMonth(
  bills: { amount: number; category?: string | null; isPaid?: boolean | null }[],
  salaries: { amount: number }[],
): MonthSummary {
  const invested = bills.filter((b) => b.category === "investimentos").reduce((s, b) => s + b.amount, 0);
  const outflow = bills.reduce((s, b) => s + b.amount, 0) - invested;
  const income = salaries.reduce((s, sal) => s + sal.amount, 0);
  const pendingBills = bills.filter((b) => !b.isPaid);
  return {
    income,
    outflow,
    invested,
    pending: pendingBills.reduce((s, b) => s + b.amount, 0),
    pendingCount: pendingBills.length,
    balance: income - outflow - invested,
  };
}
