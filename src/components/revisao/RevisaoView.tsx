"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2, ClipboardList, XCircle } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Tabs from "@/components/ui/Tabs";
import { BRL, MONTHS } from "@/lib/month";
import type { CheckinRow, GateMode, RevisaoContext } from "@/lib/revisao";
import RevisaoFlow from "./RevisaoFlow";

type Tab = "revisar" | "evolucao" | "historico";

const axis = { fill: "rgb(var(--text-muted))", fontSize: 11 };
const tooltipStyle = {
  background: "rgb(var(--surface))",
  border: "1px solid rgb(var(--border))",
  borderRadius: 10,
  color: "rgb(var(--text))",
  fontSize: 12,
};

function rowLabel(c: CheckinRow) {
  return c.type === "monthly" ? `Fechamento ${MONTHS[c.month - 1]}` : `Semana ${c.weekNumber}/${c.year}`;
}

export default function RevisaoView({ context }: Readonly<{ context: RevisaoContext }>) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("revisar");
  const [running, setRunning] = useState<GateMode | null>(null);
  const { status } = context;

  return (
    <div className="space-y-5 max-w-3xl">
      <Tabs
        tabs={[
          { value: "revisar", label: "Revisar" },
          { value: "evolucao", label: "Evolução" },
          { value: "historico", label: "Histórico", count: context.history.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "revisar" &&
        (running ? (
          <div className="card p-5 max-w-lg">
            <RevisaoFlow
              context={context}
              mode={running}
              onCancel={() => setRunning(null)}
              onDone={() => {
                setRunning(null);
                router.refresh();
              }}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <StartCard
              icon={<CalendarCheck size={20} />}
              title="Revisão semanal"
              done={status.weeklyDone}
              detail={`Semana ${status.week.weekNumber} · conferir, futuras, termômetro e decisão`}
              onStart={() => setRunning("weekly")}
            />
            <StartCard
              icon={<ClipboardList size={20} />}
              title={`Fechamento de ${MONTHS[status.month.month - 1]}`}
              done={status.monthlyDone}
              detail="Inclui confirmar o saldo devedor de cada dívida"
              onStart={() => setRunning("monthly")}
            />
          </div>
        ))}

      {tab === "evolucao" && <Evolution history={context.history} />}

      {tab === "historico" && <History history={context.history} />}
    </div>
  );
}

function StartCard({
  icon,
  title,
  done,
  detail,
  onStart,
}: Readonly<{ icon: React.ReactNode; title: string; done: boolean; detail: string; onStart: () => void }>) {
  return (
    <button onClick={onStart} className="card p-5 text-left space-y-3 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgb(var(--surface-raised))", color: done ? "rgb(var(--accent))" : "rgb(var(--text-soft))" }}
        >
          {icon}
        </span>
        {done ? (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "rgb(var(--accent))" }}>
            <CheckCircle2 size={14} /> feita
          </span>
        ) : (
          <span className="badge-pending text-[11px] font-semibold px-2 py-0.5 rounded-full">pendente</span>
        )}
      </div>
      <div>
        <div className="font-bold">{title}</div>
        <div className="text-xs mt-1" style={{ color: "rgb(var(--text-muted))" }}>
          {detail}
        </div>
      </div>
      <div className="text-xs font-semibold" style={{ color: "rgb(var(--accent))" }}>
        {done ? "Refazer" : "Começar"} →
      </div>
    </button>
  );
}

// Linha do tempo: as três notas por semana sobre a dívida total; decisões e se foram cumpridas.
function Evolution({ history }: Readonly<{ history: CheckinRow[] }>) {
  const rows = [...history]
    .filter((c) => c.data.scores || c.data.snapshot)
    .reverse()
    .map((c) => ({
      name: c.type === "monthly" ? MONTHS[c.month - 1].slice(0, 3) : `S${c.weekNumber}`,
      Controle: c.data.scores?.controle,
      "Preocupação c/ dívidas": c.data.scores?.preocupacaoDividas,
      Confiança: c.data.scores?.confianca,
      Dívida: c.data.snapshot?.dividaTotal,
    }));

  const decisions = history.filter((c) => c.data.decision);
  // previousDecisionKept da revisão N avalia a decisão da revisão N-1
  const keptFor = new Map<number, boolean | null | undefined>();
  history.forEach((c, i) => {
    const prev = history.slice(i + 1).find((p) => p.data.decision);
    if (prev) keptFor.set(prev.id, c.data.previousDecisionKept);
  });

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-sm" style={{ color: "rgb(var(--text-muted))" }}>
        A evolução aparece a partir da primeira revisão com termômetro. Cada revisão guarda um retrato dos números.
      </div>
    );
  }

  const hasDebt = rows.some((r) => r.Dívida !== undefined && r.Dívida > 0);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="text-sm font-bold">Termômetro semana a semana</h3>
        <p className="text-xs mt-0.5" style={{ color: "rgb(var(--text-muted))" }}>
          Notas de 1 a 5{hasDebt ? "; a linha tracejada é a dívida total no dia da revisão" : ""}.
        </p>
        <div className="h-64 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
              <YAxis yAxisId="score" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={axis} axisLine={false} tickLine={false} width={24} />
              {hasDebt && (
                <YAxis
                  yAxisId="debt"
                  orientation="right"
                  tick={axis}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
              )}
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, name: string) => (name === "Dívida" ? BRL(v) : v)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgb(var(--text-soft))" }} />
              <Line yAxisId="score" dataKey="Controle" stroke="rgb(var(--accent))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="score" dataKey="Preocupação c/ dívidas" stroke="rgb(var(--warning))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="score" dataKey="Confiança" stroke="rgb(var(--violet))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              {hasDebt && (
                <Line yAxisId="debt" dataKey="Dívida" stroke="rgb(var(--text-muted))" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {decisions.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-bold mb-3">Decisões</h3>
          <ul className="divide-y divide-line">
            {decisions.map((c) => {
              const kept = keptFor.get(c.id);
              return (
                <li key={c.id} className="flex items-start gap-3 py-2.5">
                  {kept === true ? (
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" style={{ color: "rgb(var(--accent))" }} />
                  ) : kept === false ? (
                    <XCircle size={16} className="mt-0.5 flex-shrink-0" style={{ color: "rgb(var(--negative))" }} />
                  ) : (
                    <span className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full" style={{ border: "1.5px dashed rgb(var(--border))" }} />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm">{c.data.decision}</p>
                    <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                      {rowLabel(c)}
                      {kept === undefined || kept === null ? " · ainda sem avaliação" : kept ? " · cumprida" : " · não cumprida"}
                    </p>
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

function History({ history }: Readonly<{ history: CheckinRow[] }>) {
  if (history.length === 0) {
    return (
      <div className="card p-8 text-center text-sm" style={{ color: "rgb(var(--text-muted))" }}>
        Nenhuma revisão registrada ainda.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {history.map((c) => (
        <div key={c.id} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{rowLabel(c)}</span>
            <span className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              {c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "—"}
            </span>
          </div>
          {c.data.scores && (
            <div className="flex gap-4 text-xs" style={{ color: "rgb(var(--text-soft))" }}>
              <span>Controle {c.data.scores.controle}/5</span>
              <span>Preocupação {c.data.scores.preocupacaoDividas}/5</span>
              <span>Confiança {c.data.scores.confianca}/5</span>
            </div>
          )}
          {c.data.answers?.filter((a) => a.answer).map((a, i) => (
            <div key={i} className="pl-3 border-l-2" style={{ borderColor: "rgb(var(--border))" }}>
              <p className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                {a.question}
              </p>
              <p className="text-sm">{a.answer}</p>
            </div>
          ))}
          {c.data.decision && (
            <div className="p-3 rounded-lg" style={{ background: "rgb(var(--surface-raised))" }}>
              <div className="label-sm mb-1">Decisão</div>
              <p className="text-sm">{c.data.decision}</p>
            </div>
          )}
          {c.data.highlight && (
            <p className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
              Aprendizado: {c.data.highlight}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
