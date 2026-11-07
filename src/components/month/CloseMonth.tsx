"use client";

import { useState } from "react";
import { CheckCircle2, Lock, RotateCcw } from "lucide-react";
import showConfirm from "@/components/ui/confirm";
import showToast from "@/components/ui/toast";
import { BRL, MONTHS } from "@/lib/month";
import type { MonthData } from "./useMonthData";

// "Fechar conta": com todas as contas pagas, fecha o mês (contas + cartões alimentação)
// e leva para o mês seguinte. Mês fechado mostra o resumo e permite reabrir.
export default function CloseMonth({ data }: Readonly<{ data: MonthData }>) {
  const { bills, closing, month, year, loading } = data;
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  if (closing) {
    const s = closing.summary;
    const balance = (s.income ?? 0) - (s.outflow ?? 0) - (s.invested ?? 0);
    return (
      <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ borderLeft: "3px solid rgb(var(--accent))" }}>
        <div className="flex items-center gap-2">
          <Lock size={16} style={{ color: "rgb(var(--accent))" }} />
          <div>
            <div className="text-sm font-bold">
              {MONTHS[month - 1]} fechado{closing.closedAt ? ` em ${new Date(`${closing.closedAt.replace(" ", "T")}Z`).toLocaleDateString("pt-BR")}` : ""}
            </div>
            <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              {s.billCount ?? 0} contas pagas · saldo {BRL(balance)}
              {s.meal?.limit ? ` · alimentação ${BRL(s.meal.spent)} de ${BRL(s.meal.limit)}` : ""}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={async () => {
              if (!(await showConfirm(`Reabrir ${MONTHS[month - 1]}? As contas e os cartões alimentação voltam a ser editáveis.`))) return;
              await data.reopenMonth();
              showToast(`${MONTHS[month - 1]} reaberto.`);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-fg/5"
            style={{ color: "rgb(var(--text-soft))" }}
          >
            <RotateCcw size={13} /> Reabrir
          </button>
          <button
            onClick={() => data.nextMonth()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))" }}
          >
            Ir para {MONTHS[month % 12]} →
          </button>
        </div>
      </div>
    );
  }

  if (bills.length === 0) return null;
  const pending = bills.filter((b) => !b.isPaid);

  if (pending.length > 0) {
    const pendingTotal = pending.reduce((s, b) => s + b.amount, 0);
    return (
      <p className="text-xs px-1" style={{ color: "rgb(var(--text-muted))" }}>
        Faltam {pending.length} conta{pending.length > 1 ? "s" : ""} ({BRL(pendingTotal)}) para poder fechar {MONTHS[month - 1]}.
      </p>
    );
  }

  async function close() {
    const ok = await showConfirm(
      `Fechar ${MONTHS[month - 1]}? As contas e os cartões alimentação do mês ficam só leitura e o Mês passa para ${MONTHS[month % 12]}.`,
    );
    if (!ok) return;
    setBusy(true);
    const res = await data.closeMonth();
    setBusy(false);
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    showToast(`${MONTHS[month - 1]} fechado. Bem-vindo a ${MONTHS[month % 12]}!`);
    const next = res.working ?? (month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year });
    data.navigate(next.month, next.year);
  }

  return (
    <div className="card p-4 flex items-center gap-3" style={{ borderLeft: "3px solid rgb(var(--accent))" }}>
      <CheckCircle2 size={20} style={{ color: "rgb(var(--accent))" }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">Todas as contas de {MONTHS[month - 1]} estão pagas</div>
        <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
          Feche o mês para guardar o resumo e focar nas contas de {MONTHS[month % 12]}.
        </div>
      </div>
      <button
        onClick={close}
        disabled={busy}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
        style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
      >
        {busy ? "Fechando..." : "Fechar conta"}
      </button>
    </div>
  );
}
