// src/components/dashboard/DashboardView.tsx
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
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarClock,
  CreditCard,
  ClipboardCheck,
} from "lucide-react";
import RiskAlerts from "./RiskAlerts";

const MONTHS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

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

interface MonthAgg {
  totalBills: number;
  paidBills: number;
  pendingBills: number;
  totalIncome: number;
  balance: number;
  billCount: number;
  paidCount: number;
  byRecurrence: { fixo: number; parcelado: number; eventual: number };
  byCategory: Array<{ category: string; amount: number }>;
}

interface DashboardData {
  year: number;
  month: number;
  months: MonthData[];
  current: MonthAgg;
  previous: MonthAgg;
  week: {
    upcoming: Array<{ id: number; name: string; amount: number; dueDate: string }>;
    cardSpend: number;
  };
}

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BRL0 = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

export default function DashboardView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [futureAlerts, setFutureAlerts] = useState<
    Array<{ id: number; name: string; reminderDate?: string }>
  >([]);

  const isCurrentPeriod =
    month === now.getMonth() + 1 && year === now.getFullYear();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year, month]);

  useEffect(() => {
    fetch(`/api/future-bills`)
      .then((r) => r.json())
      .then((items) => {
        const notNotified = (items || [])
          .filter((i: { notified?: boolean }) => !i.notified)
          .slice(0, 5);
        setFutureAlerts(
          notNotified.map((i: { id: number; name: string; reminderDate?: string }) => ({
            id: i.id,
            name: i.name,
            reminderDate: i.reminderDate,
          })),
        );
      })
      .catch(() => setFutureAlerts([]));
  }, []);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  const monthLabel = format(new Date(year, month - 1), "MMMM 'de' yyyy", {
    locale: ptBR,
  }).replace(/^\w/, (c) => c.toUpperCase());

  const chartData =
    data?.months.map((d, i) => ({
      name: MONTHS_SHORT[i],
      Contas: d.totalBills,
      Renda: d.totalIncome,
      Saldo: d.balance,
    })) || [];

  return (
    <div className="space-y-5">
      {/* Navegação por mês */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 rounded-lg transition-colors"
            style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span
            className="font-black text-lg min-w-[9.5rem] text-center"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {monthLabel}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="p-2 rounded-lg transition-colors"
            style={{ background: "#1c2b22", color: "#8dcdb0", border: "1px solid #2a3d31" }}
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {!isCurrentPeriod && (
          <button
            onClick={() => {
              setMonth(now.getMonth() + 1);
              setYear(now.getFullYear());
            }}
            className="text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: "#1c2b22", color: "#5ab28d", border: "1px solid #2a3d31" }}
          >
            Hoje
          </button>
        )}
      </div>

      {/* Alertas de comportamento de risco */}
      <RiskAlerts />

      {loading || !data ? (
        <div className="card p-8 text-center" style={{ color: "#4a6b58" }}>
          Carregando...
        </div>
      ) : (
        <>
          <MonthHealth data={data} monthLabel={monthLabel} month={month} year={year} />

          <div className="grid gap-5 lg:grid-cols-2">
            <WeekAhead week={data.week} isCurrentPeriod={isCurrentPeriod} />
            <MonthComparison current={data.current} previous={data.previous} />
          </div>

          <MonthComposition current={data.current} />

          {/* Tendência anual */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: "#8dcdb0", fontFamily: "var(--font-display)" }}>
                Contas vs Renda ({year})
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3d31" />
                  <XAxis dataKey="name" tick={{ fill: "#4a6b58", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#4a6b58", fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
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
                  <YAxis tick={{ fill: "#4a6b58", fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#1c2b22", border: "1px solid #2a3d31", borderRadius: "8px", color: "#f0f9f4" }}
                    formatter={(v: number) => BRL(v)}
                  />
                  <Line type="monotone" dataKey="Saldo" stroke="#5ab28d" strokeWidth={2} dot={{ fill: "#5ab28d", strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: "#5ab28d" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lembretes de contas futuras */}
          {futureAlerts.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold" style={{ color: "#fcd34d" }}>
                  Lembretes: contas futuras
                </div>
                <Link href="future" className="text-xs" style={{ color: "#5ab28d" }}>
                  Gerenciar
                </Link>
              </div>
              <div className="space-y-1">
                {futureAlerts.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <div style={{ color: "#f0f9f4" }}>{f.name}</div>
                    <div style={{ color: "#4a6b58" }}>
                      {f.reminderDate ? format(parseISO(f.reminderDate), "dd/MM") : "(sem data)"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grade anual — clique para selecionar o mês */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "#8dcdb0", fontFamily: "var(--font-display)" }}>
              Resumo anual ({year})
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {data.months.map((m, i) => {
                const selected = i + 1 === month;
                const isThisMonth = i + 1 === now.getMonth() + 1 && year === now.getFullYear();
                const hasData = m.billCount > 0;
                const balancePositive = m.balance >= 0;
                return (
                  <button
                    key={i}
                    onClick={() => setMonth(i + 1)}
                    className="rounded-xl p-3 text-center transition-all hover:scale-[1.03]"
                    style={{
                      background: selected ? "rgba(56,150,113,0.18)" : "#1c2b22",
                      border: selected
                        ? "1px solid rgba(56,150,113,0.55)"
                        : isThisMonth
                          ? "1px solid rgba(56,150,113,0.3)"
                          : "1px solid #2a3d31",
                    }}
                  >
                    <div className="text-xs font-semibold mb-1" style={{ color: selected ? "#5ab28d" : "#8dcdb0" }}>
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
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Saúde do mês (hero) ────────────────────────────────────────────────────────
function MonthHealth({
  data,
  monthLabel,
  month,
  year,
}: Readonly<{ data: DashboardData; monthLabel: string; month: number; year: number }>) {
  const c = data.current;
  const positive = c.balance >= 0;
  const paidPct = c.billCount > 0 ? Math.round((c.paidCount / c.billCount) * 100) : 0;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "#4a6b58" }}>
            Saldo de {monthLabel}
          </div>
          <div className="text-3xl font-black font-numeric mt-1" style={{ color: positive ? "#5ab28d" : "#ef4444" }}>
            {BRL(c.balance)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: positive ? "rgba(56,150,113,0.15)" : "rgba(239,68,68,0.12)",
              color: positive ? "#5ab28d" : "#ef4444",
              border: `1px solid ${positive ? "rgba(56,150,113,0.4)" : "rgba(239,68,68,0.35)"}`,
            }}
          >
            {positive ? "No plano" : "Atenção: no vermelho"}
          </span>
          <Link
            href={`/contas?month=${month}&year=${year}`}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "#5ab28d" }}
          >
            Ver contas <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Renda" value={BRL(c.totalIncome)} color="#5ab28d" />
        <Stat label="Total contas" value={BRL(c.totalBills)} color="#f0f9f4" />
        <Stat label="Pago" value={BRL(c.paidBills)} color="#5ab28d" />
        <Stat label="A pagar" value={BRL(c.pendingBills)} color={c.pendingBills > 0 ? "#f59e0b" : "#4a6b58"} />
      </div>

      {c.billCount > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: "#4a6b58" }}>
              {c.paidCount}/{c.billCount} contas pagas
            </span>
            <span className="text-xs" style={{ color: "#4a6b58" }}>{paidPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "#2a3d31" }}>
            <div className="h-full rounded-full transition-all" style={{ background: "#389671", width: `${paidPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Esta semana (horizonte curto) ──────────────────────────────────────────────
function WeekAhead({
  week,
  isCurrentPeriod,
}: Readonly<{ week: DashboardData["week"]; isCurrentPeriod: boolean }>) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#8dcdb0", fontFamily: "var(--font-display)" }}>
          <CalendarClock size={15} /> Esta semana
        </h3>
        <Link href="checkin" className="flex items-center gap-1 text-xs font-medium" style={{ color: "#5ab28d" }}>
          <ClipboardCheck size={13} /> Check-in
        </Link>
      </div>

      {!isCurrentPeriod ? (
        <div className="text-xs py-2" style={{ color: "#4a6b58" }}>
          Selecione o mês atual para ver o que vence nesta semana.
        </div>
      ) : (
        <>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "#4a6b58" }}>
            A vencer nos próximos 7 dias
          </div>
          {week.upcoming.length === 0 ? (
            <div className="text-sm py-1" style={{ color: "#4a6b58" }}>
              Nenhuma conta a vencer nos próximos 7 dias 🎉
            </div>
          ) : (
            <div className="space-y-1.5">
              {week.upcoming.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <span className="truncate" style={{ color: "#f0f9f4" }}>{u.name}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs" style={{ color: "#f59e0b" }}>
                      {format(parseISO(u.dueDate), "dd/MM")}
                    </span>
                    <span className="font-numeric font-semibold" style={{ color: "#f0f9f4" }}>
                      {BRL(u.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: "#2a3d31" }}>
        <span className="text-xs flex items-center gap-1.5" style={{ color: "#4a6b58" }}>
          <CreditCard size={13} /> Gasto no cartão (7 dias)
        </span>
        <span className="font-numeric font-bold text-sm" style={{ color: "#f0f9f4" }}>
          {BRL(week.cardSpend)}
        </span>
      </div>
    </div>
  );
}

// ─── Comparação mês vs mês anterior ─────────────────────────────────────────────
function MonthComparison({
  current,
  previous,
}: Readonly<{ current: MonthAgg; previous: MonthAgg }>) {
  const paidRate = (a: MonthAgg) => (a.billCount > 0 ? (a.paidCount / a.billCount) * 100 : 0);

  const catChanges = (() => {
    const keys = new Set([
      ...current.byCategory.map((x) => x.category),
      ...previous.byCategory.map((x) => x.category),
    ]);
    const prevMap = new Map(previous.byCategory.map((x) => [x.category, x.amount]));
    const currMap = new Map(current.byCategory.map((x) => [x.category, x.amount]));
    return Array.from(keys)
      .map((k) => ({ category: k, delta: (currMap.get(k) || 0) - (prevMap.get(k) || 0) }))
      .filter((x) => Math.abs(x.delta) >= 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
  })();

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "#8dcdb0", fontFamily: "var(--font-display)" }}>
        vs mês anterior
      </h3>
      <div className="space-y-2.5">
        <DeltaRow label="Contas" current={current.totalBills} previous={previous.totalBills} positiveIsGood={false} />
        <DeltaRow label="Renda" current={current.totalIncome} previous={previous.totalIncome} positiveIsGood />
        <DeltaRow label="Saldo" current={current.balance} previous={previous.balance} positiveIsGood />
        <DeltaRow label="Contas pagas" current={paidRate(current)} previous={paidRate(previous)} positiveIsGood suffix="%" digits={0} />
      </div>

      {catChanges.length > 0 && (
        <div className="mt-4 pt-3 border-t" style={{ borderColor: "#2a3d31" }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "#4a6b58" }}>
            Principais variações por categoria
          </div>
          <div className="space-y-1.5">
            {catChanges.map((c) => {
              const up = c.delta > 0;
              return (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="capitalize" style={{ color: "#8dcdb0" }}>{c.category}</span>
                  <span className="flex items-center gap-1 font-numeric" style={{ color: up ? "#ef4444" : "#5ab28d" }}>
                    {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {up ? "+" : "−"}{BRL0(Math.abs(c.delta))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DeltaRow({
  label,
  current,
  previous,
  positiveIsGood,
  suffix = "",
  digits = 2,
}: Readonly<{
  label: string;
  current: number;
  previous: number;
  positiveIsGood: boolean;
  suffix?: string;
  digits?: number;
}>) {
  const delta = current - previous;
  const flat = Math.abs(delta) < (suffix === "%" ? 0.5 : 0.01);
  const up = delta > 0;
  const good = flat ? null : up === positiveIsGood;
  const color = flat ? "#4a6b58" : good ? "#5ab28d" : "#ef4444";
  const pct = previous !== 0 ? Math.round((delta / Math.abs(previous)) * 100) : null;

  const fmt = (v: number) =>
    suffix === "%"
      ? `${v.toFixed(digits)}%`
      : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: "#8dcdb0" }}>{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-numeric text-sm" style={{ color: "#f0f9f4" }}>{fmt(current)}</span>
        <span className="flex items-center gap-1 text-xs font-medium min-w-[5.5rem] justify-end" style={{ color }}>
          {flat ? <Minus size={12} /> : up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {flat
            ? "estável"
            : `${up ? "+" : "−"}${fmt(Math.abs(delta))}${pct !== null ? ` (${up ? "+" : "−"}${Math.abs(pct)}%)` : ""}`}
        </span>
      </div>
    </div>
  );
}

// ─── Composição do mês ──────────────────────────────────────────────────────────
function MonthComposition({ current }: Readonly<{ current: MonthAgg }>) {
  const { fixo, parcelado, eventual } = current.byRecurrence;
  const total = fixo + parcelado + eventual;
  const segs = [
    { label: "Fixo (SEMPRE)", value: fixo, color: "#389671" },
    { label: "Parcelado", value: parcelado, color: "#f59e0b" },
    { label: "Eventual", value: eventual, color: "#8dcdb0" },
  ];
  const topCats = current.byCategory.slice(0, 5);
  const maxCat = topCats[0]?.amount || 1;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "#8dcdb0", fontFamily: "var(--font-display)" }}>
        Composição do mês
      </h3>

      {total === 0 ? (
        <div className="text-sm py-1" style={{ color: "#4a6b58" }}>
          Sem contas neste mês.
        </div>
      ) : (
        <>
          {/* Barra empilhada por recorrência */}
          <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "#2a3d31" }}>
            {segs.map((s) => s.value > 0 && (
              <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {segs.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 text-xs" style={{ color: "#8dcdb0" }}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
                <span className="font-numeric" style={{ color: "#4a6b58" }}>{BRL0(s.value)}</span>
              </div>
            ))}
          </div>

          {/* Top categorias */}
          {topCats.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="text-xs uppercase tracking-wide" style={{ color: "#4a6b58" }}>
                Onde o dinheiro foi (top categorias)
              </div>
              {topCats.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="capitalize" style={{ color: "#8dcdb0" }}>{cat.category}</span>
                    <span className="font-numeric" style={{ color: "#f0f9f4" }}>{BRL(cat.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#2a3d31" }}>
                    <div className="h-full rounded-full" style={{ background: "#389671", width: `${(cat.amount / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: Readonly<{ label: string; value: string; color: string }>) {
  return (
    <div className="card-elevated rounded-xl p-3">
      <div className="text-xs mb-1" style={{ color: "#4a6b58", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div className="text-base font-bold font-numeric" style={{ color }}>{value}</div>
    </div>
  );
}
