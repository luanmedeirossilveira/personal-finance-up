"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Plus } from "lucide-react";
import { BRL, MONTHS } from "@/lib/month";
import type { BillSort, OwnershipFilter } from "./types";

export const OWNERSHIP_LABEL: Record<OwnershipFilter, string> = {
  all: "Todas",
  mine: "Minhas",
  joint: "Conjuntas",
  hers: "Dela",
};

const SORT_OPTIONS: { value: BillSort; label: string }[] = [
  { value: "date", label: "Data de pagamento" },
  { value: "name", label: "Nome (A-Z)" },
];

// Cabeçalho do Mês: navegação, menu "⋯" (dono, ordenação, migração) e a linha-resumo.
export default function MonthHeader({
  month,
  year,
  onPrev,
  onNext,
  onNewBill,
  ownershipFilter,
  onOwnershipFilter,
  sortBy,
  onSort,
  onMigrate,
  migrateLabel,
  migrateDisabled,
  closed = false,
  income,
  outflow,
  invested,
  pending = 0,
  bank = null,
  meal = null,
}: Readonly<{
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
  /** Sem handler (mês fechado), o botão some. */
  onNewBill?: () => void;
  ownershipFilter: OwnershipFilter;
  onOwnershipFilter: (v: OwnershipFilter) => void;
  sortBy: BillSort;
  onSort: (v: BillSort) => void;
  onMigrate: () => void;
  migrateLabel: string;
  migrateDisabled: boolean;
  closed?: boolean;
  income: number;
  outflow: number;
  invested: number;
  /** Ainda a pagar no mês (contas em aberto). */
  pending?: number;
  /** Saldo de hoje nas contas do banco (só no mês em andamento). */
  bank?: { balance: number; syncedAt: string | null; label: string } | null;
  /** Cartões alimentação do mês: limite e gasto (saldo = limite − gasto). */
  meal?: { limit: number; spent: number; count: number } | null;
}>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const balance = income - outflow - invested;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            aria-label="Mês anterior"
            className="p-2 rounded-lg transition-colors hover:bg-fg/5"
            style={{ color: "rgb(var(--text-soft))" }}
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold min-w-36 text-center">
            {MONTHS[month - 1]} {year}
            {closed && (
              <span className="ml-2 align-middle text-[11px] font-semibold px-2 py-0.5 rounded-full badge-paid">fechado</span>
            )}
          </h2>
          <button
            onClick={onNext}
            aria-label="Próximo mês"
            className="p-2 rounded-lg transition-colors hover:bg-fg/5"
            style={{ color: "rgb(var(--text-soft))" }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Mais opções"
              className="p-2 rounded-xl transition-colors"
              style={{
                background: "rgb(var(--surface-raised))",
                color: ownershipFilter === "all" ? "rgb(var(--text-soft))" : "rgb(var(--accent))",
                border: "1px solid rgb(var(--border))",
              }}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 z-50 mt-2 w-60 rounded-xl overflow-hidden p-2 space-y-2"
                  style={{
                    background: "rgb(var(--surface))",
                    border: "1px solid rgb(var(--border))",
                    boxShadow: "var(--shadow)",
                  }}
                >
                  <div className="label-sm px-2 pt-1">Dono</div>
                  {(Object.keys(OWNERSHIP_LABEL) as OwnershipFilter[]).map((key) => (
                    <MenuItem
                      key={key}
                      active={ownershipFilter === key}
                      onClick={() => {
                        onOwnershipFilter(key);
                        setMenuOpen(false);
                      }}
                    >
                      {OWNERSHIP_LABEL[key]}
                    </MenuItem>
                  ))}
                  <div className="h-px" style={{ background: "rgb(var(--border))" }} />
                  <div className="label-sm px-2">Ordenar por</div>
                  {SORT_OPTIONS.map((opt) => (
                    <MenuItem
                      key={opt.value}
                      active={sortBy === opt.value}
                      onClick={() => {
                        onSort(opt.value);
                        setMenuOpen(false);
                      }}
                    >
                      {opt.label}
                    </MenuItem>
                  ))}
                  <div className="h-px" style={{ background: "rgb(var(--border))" }} />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onMigrate();
                    }}
                    disabled={migrateDisabled}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-left hover:bg-fg/5 disabled:opacity-50"
                    style={{ color: "rgb(var(--text-soft))" }}
                  >
                    <Copy size={15} />
                    {migrateLabel}
                  </button>
                </div>
              </>
            )}
          </div>

          {onNewBill && (
            <button
              onClick={onNewBill}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nova conta</span>
            </button>
          )}
        </div>
      </div>

      {/* Resumo: entradas e saídas do mês numa linha; saldo atual (banco) vs. saldo previsto */}
      <div className="card px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Figure label="Entradas" value={income} color="rgb(var(--accent))" />
          <Figure label="Saídas" value={outflow} color="rgb(var(--text))" />
          {invested > 0 && <Figure label="Investido" value={invested} color="rgb(var(--violet))" />}
          {pending > 0 && <Figure label="A pagar" value={pending} color="rgb(var(--warning))" />}
          {ownershipFilter !== "all" && (
            <span className="text-xs ml-auto" style={{ color: "rgb(var(--text-muted))" }}>
              Lista filtrada: {OWNERSHIP_LABEL[ownershipFilter]}
            </span>
          )}
        </div>

        <div
          className={`grid gap-3 pt-3 ${
            [bank, meal].filter(Boolean).length === 2 ? "grid-cols-2 sm:grid-cols-3" : [bank, meal].some(Boolean) ? "grid-cols-2" : "grid-cols-1"
          }`}
          style={{ borderTop: "1px solid rgb(var(--border))" }}
        >
          {bank && (
            <BalanceBox
              label="Saldo atual"
              value={bank.balance}
              note={`${bank.label}${bank.syncedAt ? ` · ${syncedLabel(bank.syncedAt)}` : ""}`}
            />
          )}
          <BalanceBox label="Saldo previsto" value={balance} note="entradas − saídas − investido do mês" />
          {meal && (
            <BalanceBox
              label="Saldo alimentação"
              value={meal.limit - meal.spent}
              note={`${BRL(meal.spent)} gastos de ${BRL(meal.limit)}${meal.count > 1 ? ` · ${meal.count} cartões` : ""}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function syncedLabel(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `há ${Math.max(mins, 1)} min`;
  const h = Math.round(mins / 60);
  return h < 24 ? `há ${h}h` : `em ${new Date(iso).toLocaleDateString("pt-BR")}`;
}

function BalanceBox({ label, value, note }: Readonly<{ label: string; value: number; note: string }>) {
  return (
    <div>
      <div className="label-sm">{label}</div>
      <div className="text-xl font-numeric mt-0.5" style={{ color: value >= 0 ? "rgb(var(--accent))" : "rgb(var(--negative))" }}>
        {BRL(value)}
      </div>
      <div className="text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
        {note}
      </div>
    </div>
  );
}

function Figure({ label, value, color }: Readonly<{ label: string; value: number; color: string }>) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="label-sm">{label}</span>
      <span className="text-base font-numeric" style={{ color }}>
        {BRL(value)}
      </span>
    </div>
  );
}

function MenuItem({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-left hover:bg-fg/5"
      style={{ color: active ? "rgb(var(--text))" : "rgb(var(--text-soft))", fontWeight: active ? 600 : 400 }}
    >
      {children}
      {active && <Check size={14} style={{ color: "rgb(var(--accent))" }} />}
    </button>
  );
}
