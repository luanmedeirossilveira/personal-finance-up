// Busca e filtros da lista de contas do Mês (sem DB). A busca afeta só a lista:
// o resumo do cabeçalho continua considerando apenas o filtro de dono.
import { SPENDING_CATEGORIES, normalizeCategory, type SpendingCategory } from "@/lib/categories";
import { matchesNameOrAmount } from "@/lib/search-shared";

export interface BillLike {
  name: string;
  amount: number;
  isPaid: boolean;
  dueDay?: number | null;
  category?: string | null;
  type?: string | null;
  installment?: string | null;
}

export type BillStatusFilter = "all" | "pending" | "paid" | "overdue";
export type BillTypeFilter = "all" | "NORMAL" | "CARD";

export interface BillFilter {
  query?: string;
  status?: BillStatusFilter;
  category?: SpendingCategory | "all";
  type?: BillTypeFilter;
  onlyInstallment?: boolean;
}

// Vencida só existe no mês corrente (`todayDay` nulo nos outros), como o badge da lista.
export function isBillOverdue(b: BillLike, todayDay: number | null): boolean {
  return todayDay !== null && !b.isPaid && !!b.dueDay && b.dueDay < todayDay;
}

// Fatura sem categoria cai em "cartão", como no restante do app.
const billCategory = (b: BillLike) => normalizeCategory(b.category ?? (b.type === "CARD" ? "cartão" : null));

function matchesStatus(b: BillLike, status: BillStatusFilter, todayDay: number | null): boolean {
  if (status === "pending") return !b.isPaid;
  if (status === "paid") return b.isPaid;
  if (status === "overdue") return isBillOverdue(b, todayDay);
  return true;
}

export function filterBills<T extends BillLike>(bills: T[], filter: BillFilter, todayDay: number | null): T[] {
  const { query = "", status = "all", category = "all", type = "all", onlyInstallment = false } = filter;
  return bills.filter(
    (b) =>
      matchesStatus(b, status, todayDay) &&
      (category === "all" || billCategory(b) === category) &&
      (type === "all" || (b.type || "NORMAL") === type) &&
      (!onlyInstallment || !!b.installment?.trim()) &&
      matchesNameOrAmount(b, query),
  );
}

export function isBillFilterActive(filter: BillFilter): boolean {
  return (
    !!filter.query?.trim() ||
    (filter.status ?? "all") !== "all" ||
    (filter.category ?? "all") !== "all" ||
    (filter.type ?? "all") !== "all" ||
    !!filter.onlyInstallment
  );
}

// Opções do filtro de categoria: só as que existem na lista, na ordem dos selects.
export function billCategoriesPresent(bills: BillLike[]): SpendingCategory[] {
  const present = new Set(bills.map(billCategory));
  return SPENDING_CATEGORIES.filter((c) => present.has(c));
}
