"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, CreditCard, Landmark } from "lucide-react";
import showToast from "@/components/ui/toast";
import { CARD_TX_CATEGORIES, categoryLabel, normalizeCategory } from "@/lib/categories";
import { BRL, formatDateBR } from "@/lib/month";
import type { CardUsage } from "@/lib/cards";
import type { MonthData } from "./useMonthData";

interface Tx {
  id: number;
  accountId: number | null;
  accountName: string | null;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  status: string;
  bill: { id: number; name: string } | null;
}

interface AccountInfo {
  id: number;
  type: string;
  billClosingDate: string | null;
}

const selectStyle = {
  background: "rgb(var(--surface-raised))",
  border: "1px solid rgb(var(--border))",
  color: "rgb(var(--text))",
} as const;

// Primeiro card da aba Contas: o que o banco trouxe e ainda não foi decidido.
// Nada vira custo sozinho — você escolhe se entra (conta, fatura, entrada) ou não.
export default function BankInbox({ data, locked }: Readonly<{ data: MonthData; locked: boolean }>) {
  const { month, year, bills, version } = data;
  const [cash, setCash] = useState<Tx[]>([]);
  const [card, setCard] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [cards, setCards] = useState<CardUsage[]>([]);
  const [open, setOpen] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [categories, setCategories] = useState<Record<number, string>>({});
  const [targets, setTargets] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const [c, k, a, u] = await Promise.all([
      fetch("/api/bank-transactions?status=pending,suggested&accounts=cash&limit=100"),
      fetch("/api/bank-transactions?status=pending&accounts=credit&direction=out&limit=200"),
      fetch("/api/accounts"),
      fetch(`/api/cards?month=${month}&year=${year}`),
    ]);
    setCash(c.ok ? await c.json() : []);
    setCard(k.ok ? await k.json() : []);
    setAccounts(a.ok ? (await a.json()).accounts ?? [] : []);
    setCards(u.ok ? await u.json() : []);
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load, version]);

  const cardBills = bills.filter((b) => b.type === "CARD");

  // Fatura sugerida para uma compra: a do cartão planejado ligado àquela conta; senão a primeira.
  function defaultTarget(tx: Tx) {
    const plan = cards.find((c) => c.accountId && c.accountId === tx.accountId);
    return String(plan?.bills[0]?.id ?? cardBills[0]?.id ?? "");
  }

  // Compras anteriores ao último fechamento da fatura já estão em faturas passadas (lançadas à mão).
  const closingOf = (accountId: number | null) => accounts.find((a) => a.id === accountId)?.billClosingDate ?? null;
  const isOld = (tx: Tx) => {
    const closing = closingOf(tx.accountId);
    return closing ? tx.date < closing : false;
  };
  const oldCard = useMemo(() => card.filter(isOld), [card, accounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const visibleCard = showOld ? card : card.filter((t) => !isOld(t));

  async function act(ids: number[], action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/bank-transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action, month, year, ...extra }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(body.error ?? "Não foi possível aplicar.");
      return false;
    }
    setCash((prev) => prev.filter((t) => !ids.includes(t.id)));
    setCard((prev) => prev.filter((t) => !ids.includes(t.id)));
    if (["confirm", "create_bill", "attach_card", "income"].includes(action)) data.fetchData();
    return true;
  }

  const pendingCount = cash.length + visibleCard.length;
  if (cash.length === 0 && card.length === 0) return null;

  return (
    <section className="card overflow-hidden" style={{ borderLeft: "3px solid rgb(var(--warning))" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-4 text-left" aria-expanded={open}>
        <AlertCircle size={18} style={{ color: "rgb(var(--warning))" }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">Movimentações do banco para verificar</div>
          <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
            {cash.length > 0 && `${cash.length} na conta`}
            {cash.length > 0 && visibleCard.length > 0 && " · "}
            {visibleCard.length > 0 && `${visibleCard.length} compras novas no cartão`}
            {pendingCount === 0 && oldCard.length > 0 && `${oldCard.length} compras antigas do cartão`}
            {" — decida o que entra nas contas"}
          </div>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full badge-pending">{pendingCount || oldCard.length}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "rgb(var(--text-soft))" }} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5">
          {locked && (
            <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              Mês fechado: o que for lançado aqui precisa ir para o mês seguinte.
            </p>
          )}

          {cash.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 label-sm">
                <Landmark size={12} /> Conta
              </div>
              <ul className="divide-y divide-line">
                {cash.map((t) => (
                  <li key={t.id} className="py-2.5 space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{t.description}</div>
                        <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                          {formatDateBR(t.date)}
                          {t.accountName ? ` · ${t.accountName}` : ""}
                          {t.status === "suggested" && t.bill && (
                            <span style={{ color: "rgb(var(--accent))" }}> · parece ser {t.bill.name}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-numeric" style={{ color: t.amount > 0 ? "rgb(var(--accent))" : "rgb(var(--text))" }}>
                        {t.amount > 0 ? "+" : "-"}
                        {BRL(Math.abs(t.amount))}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {t.status === "suggested" ? (
                        <>
                          <Action primary onClick={() => act([t.id], "confirm")}>É essa conta (paga)</Action>
                          <Action onClick={() => act([t.id], "reject")}>Não é</Action>
                        </>
                      ) : t.amount > 0 ? (
                        <Action primary onClick={() => act([t.id], "income")}>Entrada do mês</Action>
                      ) : (
                        <>
                          <select
                            value={categories[t.id] ?? (t.category ? normalizeCategory(t.category) : "")}
                            onChange={(e) => setCategories((p) => ({ ...p, [t.id]: e.target.value }))}
                            className="text-xs rounded-lg px-1.5 py-1"
                            style={selectStyle}
                            aria-label="Categoria"
                          >
                            <option value="">categoria…</option>
                            {CARD_TX_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {categoryLabel(c)}
                              </option>
                            ))}
                          </select>
                          <Action primary disabled={locked} onClick={() => act([t.id], "create_bill", { category: categories[t.id] ?? t.category })}>
                            Virar conta
                          </Action>
                          <Action onClick={() => act([t.id], "known")}>Já lançada</Action>
                        </>
                      )}
                      <Action onClick={() => act([t.id], "ignore")}>Ignorar</Action>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {card.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 label-sm">
                  <CreditCard size={12} /> Compras novas no cartão
                </div>
                {oldCard.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <button onClick={() => setShowOld((v) => !v)} style={{ color: "rgb(var(--text-soft))" }}>
                      {showOld ? "esconder antigas" : `mostrar ${oldCard.length} antigas`}
                    </button>
                    <button
                      onClick={async () => {
                        if (await act(oldCard.map((t) => t.id), "known")) showToast(`${oldCard.length} compras antigas marcadas como já lançadas.`);
                      }}
                      className="font-semibold"
                      style={{ color: "rgb(var(--accent))" }}
                    >
                      marcar antigas como já lançadas
                    </button>
                  </div>
                )}
              </div>
              {oldCard.length > 0 && !showOld && (
                <p className="text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                  Compras anteriores ao fechamento da fatura ({formatDateBR(closingOf(oldCard[0].accountId) ?? "").slice(0, 5)}) já estão em
                  faturas passadas.
                </p>
              )}
              <ul className="divide-y divide-line">
                {visibleCard.map((t) => (
                  <li key={t.id} className="py-2.5 space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{t.description}</div>
                        <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                          {formatDateBR(t.date)}
                          {t.accountName ? ` · ${t.accountName}` : ""}
                        </div>
                      </div>
                      <span className="text-sm font-numeric">{BRL(Math.abs(t.amount))}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {cardBills.length > 0 ? (
                        <>
                          <select
                            value={targets[t.id] ?? defaultTarget(t)}
                            onChange={(e) => setTargets((p) => ({ ...p, [t.id]: e.target.value }))}
                            className="text-xs rounded-lg px-1.5 py-1 max-w-40"
                            style={selectStyle}
                            aria-label="Fatura"
                          >
                            {cardBills.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.cardNickname || b.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={categories[t.id] ?? (t.category ? normalizeCategory(t.category) : "")}
                            onChange={(e) => setCategories((p) => ({ ...p, [t.id]: e.target.value }))}
                            className="text-xs rounded-lg px-1.5 py-1"
                            style={selectStyle}
                            aria-label="Categoria"
                          >
                            <option value="">categoria…</option>
                            {CARD_TX_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {categoryLabel(c)}
                              </option>
                            ))}
                          </select>
                          <Action
                            primary
                            disabled={locked}
                            onClick={() =>
                              act([t.id], "attach_card", {
                                billId: Number(targets[t.id] ?? defaultTarget(t)),
                                category: categories[t.id] ?? t.category,
                              })
                            }
                          >
                            Adicionar à fatura
                          </Action>
                        </>
                      ) : (
                        <span className="text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                          Crie a fatura do cartão neste mês para lançar.
                        </span>
                      )}
                      <Action onClick={() => act([t.id], "known")}>Já lançada</Action>
                      <Action onClick={() => act([t.id], "ignore")}>Ignorar</Action>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Action({
  children,
  onClick,
  primary = false,
  disabled = false,
}: Readonly<{ children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-50"
      style={
        primary
          ? { background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }
          : { background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))", border: "1px solid rgb(var(--border))" }
      }
    >
      {children}
    </button>
  );
}
