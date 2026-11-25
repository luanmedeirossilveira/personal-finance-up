// Regras puras da fatura do cartão (sem DB): ordem, filtros e conferência.
// A fatura é conferida contra o app do banco, que tem a ordem dele — por isso a
// ordem manual (`position`) manda; sem ela, vale a ordem padrão (data mais recente primeiro).
import { matchesNameOrAmount } from "@/lib/search-shared";

export interface CardTxLike {
  id: number;
  name: string;
  amount: number;
  installment?: string | null;
  recurring?: boolean | null;
  date?: string | null;
  position?: number | null;
  checked?: boolean | null;
}

export type CardTxKind = "all" | "avista" | "parcelada" | "recorrente";

export interface CardTxFilter {
  query?: string;
  kind?: CardTxKind;
  onlyUnchecked?: boolean;
}

// Com posição primeiro (crescente); sem posição depois, por data desc e id desc.
// Compra nova lançada depois de reordenar cai no fim, para ser arrastada ao lugar dela.
export function sortCardTransactions<T extends CardTxLike>(txs: T[]): T[] {
  return [...txs].sort((a, b) => {
    const pa = a.position ?? null;
    const pb = b.position ?? null;
    if (pa !== null && pb !== null) return pa - pb || b.id - a.id;
    if (pa !== null) return -1;
    if (pb !== null) return 1;
    const da = a.date || "";
    const dbb = b.date || "";
    if (da !== dbb) return da < dbb ? 1 : -1;
    return b.id - a.id;
  });
}

export function cardTxKind(t: CardTxLike): Exclude<CardTxKind, "all"> {
  if (t.recurring) return "recorrente";
  if (t.installment && t.installment.trim() !== "") return "parcelada";
  return "avista";
}

export function filterCardTransactions<T extends CardTxLike>(txs: T[], filter: CardTxFilter): T[] {
  const { query = "", kind = "all", onlyUnchecked = false } = filter;
  return txs.filter(
    (t) =>
      (kind === "all" || cardTxKind(t) === kind) &&
      (!onlyUnchecked || !t.checked) &&
      matchesNameOrAmount(t, query),
  );
}

export function isCardTxFilterActive(filter: CardTxFilter): boolean {
  return !!filter.query?.trim() || (filter.kind ?? "all") !== "all" || !!filter.onlyUnchecked;
}

export function summarizeChecked(txs: CardTxLike[]) {
  let checkedCount = 0;
  let checkedTotal = 0;
  let pendingTotal = 0;
  for (const t of txs) {
    if (t.checked) {
      checkedCount++;
      checkedTotal += t.amount;
    } else {
      pendingTotal += t.amount;
    }
  }
  return { count: txs.length, checkedCount, checkedTotal, pendingTotal };
}

// Move o item de `from` para `to` (usado no arrastar e nas setas do modo reordenar).
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
