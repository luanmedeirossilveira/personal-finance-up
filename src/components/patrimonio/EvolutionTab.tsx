"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BRL } from "@/lib/month";
import type { NetWorthSnapshot } from "@/lib/db/schema";

interface MonthRow {
  month: number;
  totalBills: number;
  totalIncome: number;
  balance: number;
}

const SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const axis = { fill: "rgb(var(--text-muted))", fontSize: 11 };
const tooltipStyle = {
  background: "rgb(var(--surface))",
  border: "1px solid rgb(var(--border))",
  borderRadius: 10,
  color: "rgb(var(--text))",
  fontSize: 12,
};

// Visão anual (saiu do antigo Dashboard): entradas vs. saídas e saldo por mês.
export default function EvolutionTab({ history }: Readonly<{ history: NetWorthSnapshot[] }>) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [months, setMonths] = useState<MonthRow[] | null>(null);

  useEffect(() => {
    setMonths(null);
    fetch(`/api/dashboard?year=${year}&month=1`)
      .then((r) => r.json())
      .then((d) => setMonths(d.months ?? []))
      .catch(() => setMonths([]));
  }, [year]);

  const rows = (months ?? []).map((m) => ({
    name: SHORT[m.month - 1],
    Entradas: m.totalIncome,
    Saídas: m.totalBills,
    Saldo: m.balance,
  }));
  const withData = (months ?? []).filter((m) => m.totalBills > 0 || m.totalIncome > 0);
  const yearBalance = withData.reduce((s, m) => s + m.balance, 0);
  const worst = [...withData].sort((a, b) => a.balance - b.balance)[0];

  // Patrimônio por mês: último retrato de cada mês.
  const byMonth = new Map<string, NetWorthSnapshot>();
  for (const h of history) byMonth.set(h.date.slice(0, 7), h);
  const netRows = Array.from(byMonth.entries()).map(([ym, h]) => ({
    name: `${SHORT[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`,
    Patrimônio: h.netWorth,
  }));

  return (
    <div className="space-y-4">
      {netRows.length > 1 && (
        <div className="card p-4">
          <h3 className="text-sm font-bold">Patrimônio líquido por mês</h3>
          <div className="h-48 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netRows}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => BRL(v)} />
                <Line type="monotone" dataKey="Patrimônio" stroke="rgb(var(--violet))" strokeWidth={2} dot={{ r: 3, fill: "rgb(var(--violet))", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => setYear((y) => y - 1)} aria-label="Ano anterior" className="p-2 rounded-lg hover:bg-fg/5" style={{ color: "rgb(var(--text-soft))" }}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-bold tabular w-14 text-center">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} aria-label="Próximo ano" className="p-2 rounded-lg hover:bg-fg/5" style={{ color: "rgb(var(--text-soft))" }}>
            <ChevronRight size={18} />
          </button>
        </div>
        {withData.length > 0 && (
          <p className="text-sm text-right" style={{ color: "rgb(var(--text-soft))" }}>
            Saldo acumulado no ano:{" "}
            <span className="font-numeric" style={{ color: yearBalance >= 0 ? "rgb(var(--accent))" : "rgb(var(--negative))" }}>
              {BRL(yearBalance)}
            </span>
          </p>
        )}
      </div>

      {months === null ? (
        <div className="card p-8 text-center" style={{ color: "rgb(var(--text-muted))" }}>
          Carregando...
        </div>
      ) : withData.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: "rgb(var(--text-muted))" }}>
          Sem lançamentos em {year}.
        </div>
      ) : (
        <>
          <div className="card p-4">
            <h3 className="text-sm font-bold">Entradas vs. saídas</h3>
            {worst && worst.balance < 0 && (
              <p className="text-xs mt-0.5" style={{ color: "rgb(var(--text-muted))" }}>
                Mês mais apertado: {SHORT[worst.month - 1]}, com {BRL(worst.balance)}.
              </p>
            )}
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                  <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgb(var(--text) / 0.04)" }} formatter={(v: number) => BRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "rgb(var(--text-soft))" }} />
                  <Bar dataKey="Entradas" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saídas" fill="rgb(var(--text-muted))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-bold">Saldo por mês</h3>
            <div className="h-48 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                  <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => BRL(v)} />
                  <Line type="monotone" dataKey="Saldo" stroke="rgb(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: "rgb(var(--accent))", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
