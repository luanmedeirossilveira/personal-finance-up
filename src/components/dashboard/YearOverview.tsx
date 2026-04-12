"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface MonthData {
  month: number;
  totalBills: number;
  paidBills: number;
  pendingBills: number;
  totalIncome: number;
  balance: number;
  billCount: number;
  paidCount: number;
}

const BRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function YearOverview() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [futureAlerts, setFutureAlerts] = useState<Array<{ id: number; name: string; reminderDate?: string }>>([]);

  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?year=${year}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Network response was not ok");
        const text = await r.text();
        if (!text) return { months: [] };
        return JSON.parse(text);
      })
      .then((d) => { setData(d.months); setLoading(false); })
      .catch(() => { setData([]); setLoading(false); });
  }, [year]);

  useEffect(() => {
    // fetch future bills for dashboard alerts
    fetch(`/api/future-bills`).then((r) => r.json()).then((items) => {
      const notNotified = (items || []).filter((i: any) => !i.notified).slice(0, 5);
      setFutureAlerts(notNotified.map((i: any) => ({ id: i.id, name: i.name, reminderDate: i.reminderDate })));
    }).catch(() => setFutureAlerts([]));
  }, []);

  const currentMonthData = data[currentMonth - 1];
  const chartData = data.map((d, i) => ({
    name: MONTHS_SHORT[i],
    Contas: d.totalBills,
    Renda: d.totalIncome,
    Saldo: d.balance,
  }));

  return (
    <div className="space-y-5">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setYear(y => y - 1)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
        >
          ‹ {year - 1}
        </button>
        <span className="font-black text-lg" style={{ fontFamily: "var(--font-display)" }}>{year}</span>
        <button
          onClick={() => setYear(y => y + 1)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
        >
          {year + 1} ›
        </button>
      </div>

      {/* Current month summary */}
      {currentMonthData && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              {format(new Date(year, currentMonth - 1), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
            </h2>
            <Link
              href={`/contas?month=${currentMonth}&year=${year}`}
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: "#5ab28d" }}
            >
              Ver contas <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total contas" value={BRL(currentMonthData.totalBills)} color="#f0f9f4" />
            <StatCard label="Renda" value={BRL(currentMonthData.totalIncome)} color="#5ab28d" />
            <StatCard label="Pago" value={BRL(currentMonthData.paidBills)} color="#5ab28d" />
            <StatCard
              label="Saldo"
              value={BRL(currentMonthData.balance)}
              color={currentMonthData.balance >= 0 ? "#5ab28d" : "#ef4444"}
            />
          </div>
          {currentMonthData.billCount > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: "#4a6b58" }}>
                  {currentMonthData.paidCount}/{currentMonthData.billCount} contas pagas
                </span>
                <span className="text-xs" style={{ color: "#4a6b58" }}>
                  {Math.round((currentMonthData.paidCount / currentMonthData.billCount) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#2a3d31" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    background: "#389671",
                    width: `${(currentMonthData.paidCount / currentMonthData.billCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#8dcdb0", fontFamily: "var(--font-display)" }}>
            Contas vs Renda ({year})
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3d31" />
              <XAxis dataKey="name" tick={{ fill: "#4a6b58", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#4a6b58", fontSize: 11 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip
                contentStyle={{ background: "#1c2b22", border: "1px solid #2a3d31", borderRadius: "8px", color: "#f0f9f4" }}
                formatter={(v: number) => BRL(v)}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#8dcdb0" }} />
              <Bar dataKey="Contas" fill="#ef4444" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Renda" fill="#5ab28d" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "#8dcdb0", fontFamily: "var(--font-display)" }}>
            Saldo mensal ({year})
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3d31" />
              <XAxis dataKey="name" tick={{ fill: "#4a6b58", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#4a6b58", fontSize: 11 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`}
              />
              <Tooltip
                contentStyle={{ background: "#1c2b22", border: "1px solid #2a3d31", borderRadius: "8px", color: "#f0f9f4" }}
                formatter={(v: number) => BRL(v)}
              />
              <Line
                type="monotone"
                dataKey="Saldo"
                stroke="#5ab28d"
                strokeWidth={2}
                dot={{ fill: "#5ab28d", strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, fill: "#5ab28d" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month grid */}
      {futureAlerts.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold" style={{ color: "#fcd34d" }}>Lembretes: contas futuras</div>
            <Link href="future" className="text-xs" style={{ color: "#5ab28d" }}>Gerenciar</Link>
          </div>
          <div className="space-y-1">
            {futureAlerts.map((f) => (
              <div key={f.id} className="flex items-center justify-between">
                <div style={{ color: "#f0f9f4" }}>{f.name}</div>
                <div style={{ color: "#4a6b58" }}>{f.reminderDate ? format(parseISO(f.reminderDate), "dd/MM") : "(sem data)"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "#8dcdb0", fontFamily: "var(--font-display)" }}>
          Resumo anual
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {data.map((m, i) => {
            const isCurrentMonth = i + 1 === currentMonth && year === new Date().getFullYear();
            const hasData = m.billCount > 0;
            const balancePositive = m.balance >= 0;
            return (
              <Link
                key={i}
                href={`/contas?month=${i + 1}&year=${year}`}
                className="rounded-xl p-3 text-center transition-all hover:scale-105"
                style={{
                  background: isCurrentMonth ? "rgba(56,150,113,0.15)" : "#1c2b22",
                  border: isCurrentMonth ? "1px solid rgba(56,150,113,0.4)" : "1px solid #2a3d31",
                }}
              >
                <div className="text-xs font-semibold mb-1" style={{ color: isCurrentMonth ? "#5ab28d" : "#8dcdb0" }}>
                  {MONTHS_SHORT[i]}
                </div>
                {hasData ? (
                  <>
                    <div className="text-xs font-bold font-numeric" style={{ color: balancePositive ? "#5ab28d" : "#ef4444" }}>
                      {BRL(m.balance).replace("R$ ", "")}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "#4a6b58" }}>
                      {m.paidCount}/{m.billCount}
                    </div>
                  </>
                ) : (
                  <div className="text-xs" style={{ color: "#2a3d31" }}>—</div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card-elevated rounded-xl p-3">
      <div className="text-xs mb-1" style={{ color: "#4a6b58", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div className="text-base font-bold font-numeric" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
