"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DebtsManager from "@/components/debts/DebtsManager";
import Tabs from "@/components/ui/Tabs";
import { BRL } from "@/lib/month";
import AccountsTab from "./AccountsTab";
import EvolutionTab from "./EvolutionTab";
import InvestmentsTab from "./InvestmentsTab";
import { usePatrimonio, type PatrimonioData } from "./usePatrimonio";

type Tab = "visao" | "contas" | "investimentos" | "dividas" | "evolucao";
const TABS: Tab[] = ["visao", "contas", "investimentos", "dividas", "evolucao"];

export interface PatrimonioSummary {
  debtTotal: number;
  debtCount: number;
  investedTotal: number;
  investedMonth: number;
  debts: { id: number; name: string; amount: number; paid: number; remaining: number; payoff: string | null }[];
}

// Tela Patrimônio: "estou indo para onde quero?". Junta contas, investimentos e dívidas.
export default function PatrimonioView({ summary }: Readonly<{ summary: PatrimonioSummary }>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : "visao");
  const { data, error, reload } = usePatrimonio();

  function changeTab(next: Tab) {
    setTab(next);
    router.replace(`/patrimonio?tab=${next}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <Tabs
        tabs={[
          { value: "visao", label: "Visão" },
          { value: "contas", label: "Contas" },
          { value: "investimentos", label: "Investimentos" },
          { value: "dividas", label: "Dívidas", count: summary.debtCount },
          { value: "evolucao", label: "Evolução" },
        ]}
        active={tab}
        onChange={changeTab}
      />

      {error && (
        <div className="card p-4 text-sm" style={{ color: "rgb(var(--negative))" }}>
          {error}
        </div>
      )}

      {tab === "visao" && <Overview summary={summary} data={data} onOpen={changeTab} />}
      {tab === "contas" && data && <AccountsTab data={data} reload={reload} />}
      {tab === "investimentos" && data && <InvestmentsTab data={data} reload={reload} />}
      {tab === "dividas" && <DebtsManager />}
      {tab === "evolucao" && <EvolutionTab history={data?.history ?? []} />}
    </div>
  );
}

function Overview({
  summary,
  data,
  onOpen,
}: Readonly<{ summary: PatrimonioSummary; data: PatrimonioData | null; onOpen: (t: Tab) => void }>) {
  const nw = data?.netWorth;
  // Variação no mês: retrato mais antigo do mês corrente vs. hoje.
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const firstOfMonth = data?.history.find((h) => h.date.startsWith(monthPrefix));
  const delta = nw && firstOfMonth ? nw.netWorth - firstOfMonth.netWorth : null;

  const parts = nw
    ? [
        { label: "Contas", value: nw.accountsTotal, color: "rgb(var(--accent))", tab: "contas" as Tab },
        { label: "Investimentos", value: nw.investmentsTotal, color: "rgb(var(--violet))", tab: "investimentos" as Tab },
        { label: "Dívidas", value: -nw.debtsTotal, color: "rgb(var(--warning))", tab: "dividas" as Tab },
      ]
    : [];
  const scale = parts.reduce((s, p) => s + Math.abs(p.value), 0) || 1;

  return (
    <div className="space-y-4">
      <div className="card p-5 md:p-6">
        <div className="label-sm">Patrimônio líquido</div>
        <div
          className="text-4xl font-numeric mt-1"
          style={{ color: nw && nw.netWorth < 0 ? "rgb(var(--negative))" : "rgb(var(--text))" }}
        >
          {nw ? BRL(nw.netWorth) : "—"}
        </div>
        <p className="text-sm mt-1" style={{ color: "rgb(var(--text-muted))" }}>
          {delta === null
            ? "Contas + investimentos − dívidas."
            : `${delta >= 0 ? "Subiu" : "Caiu"} ${BRL(Math.abs(delta))} desde o início do mês.`}
        </p>

        {nw && (
          <>
            <div className="flex h-2.5 rounded-full overflow-hidden mt-5 gap-0.5" aria-hidden>
              {parts.map((p) => (
                <div key={p.label} style={{ width: `${(Math.abs(p.value) / scale) * 100}%`, background: p.color }} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {parts.map((p) => (
                <button key={p.label} onClick={() => onOpen(p.tab)} className="text-left hover:opacity-80">
                  <div className="flex items-center gap-1.5 label-sm">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </div>
                  <div className="text-base font-numeric mt-0.5">{BRL(p.value)}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {summary.investedMonth > 0 && (
        <p className="text-sm px-1" style={{ color: "rgb(var(--text-soft))" }}>
          Aportes pagos neste mês: <span className="font-numeric">{BRL(summary.investedMonth)}</span> (de{" "}
          {BRL(summary.investedTotal)} registrados no total).
        </p>
      )}

      {summary.debts.length > 0 && (
        <div className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold">Progresso das dívidas</h3>
            <button onClick={() => onOpen("dividas")} className="text-xs font-semibold" style={{ color: "rgb(var(--accent))" }}>
              Gerenciar
            </button>
          </div>
          <ul className="space-y-3">
            {summary.debts.map((d) => {
              const pct = d.amount > 0 ? Math.min(d.paid / d.amount, 1) : 0;
              return (
                <li key={d.id}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate pr-2">{d.name}</span>
                    <span className="font-numeric">{BRL(d.remaining)}</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgb(var(--border))" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: "rgb(var(--accent))" }} />
                  </div>
                  <div className="text-xs mt-1" style={{ color: "rgb(var(--text-muted))" }}>
                    {Math.round(pct * 100)}% pago · {BRL(d.paid)} de {BRL(d.amount)}
                    {d.payoff && ` · quitada em ${d.payoff} no ritmo atual`}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
