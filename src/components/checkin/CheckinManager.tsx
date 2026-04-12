// src/components/checkin/CheckinManager.tsx
"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  CalendarCheck,
  ClipboardList,
  Clock,
  Sparkles,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DueSoon {
  name: string;
  amount: number;
  dueDay: number;
}

interface RevisaoContext {
  month: number;
  year: number;
  weekNumber: number;
  totalBills: number;
  paidBills: number;
  pendingBills: number;
  totalIncome: number;
  balance: number;
  billCount: number;
  paidCount: number;
  dueSoon: DueSoon[];
  doneThisWeek: boolean;
  doneThisMonth: boolean;
  recentCheckins: Array<{
    id: number;
    weekNumber: number;
    month: number;
    year: number;
    type: string;
    createdAt: string | null;
    data: CheckinData;
  }>;
}

interface Answer {
  question: string;
  answer: string;
}

interface CheckinData {
  answers?: Answer[];
  decision?: string;
  highlight?: string;
  improvement?: string;
}

type Mode = "home" | "weekly" | "monthly" | "history";

// ─── Constantes ───────────────────────────────────────────────────────────────
const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const BRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

// Perguntas do check-in semanal — dinâmicas (recebem contexto)
function buildWeeklyQuestions(ctx: RevisaoContext): string[] {
  const pending = BRL(ctx.pendingBills);
  const balance = BRL(ctx.balance);
  const dueSoonStr =
    ctx.dueSoon.length > 0
      ? ctx.dueSoon.map((d) => `${d.name} (dia ${d.dueDay})`).join(", ")
      : "nenhuma";

  return [
    `Como foi a semana financeiramente para vocês? Tiveram gastos inesperados?`,
    `Vocês têm ${pending} pendentes este mês. Algo mudou em relação ao planejado?`,
    ctx.dueSoon.length > 0
      ? `Atenção: ${dueSoonStr} vencem em breve. Já estão organizados para pagar?`
      : `Não há contas vencendo nos próximos 5 dias. Aproveitaram para adiantar algum pagamento?`,
    `Saldo atual do mês: ${balance}. Está de acordo com o esperado?`,
    `Há alguma decisão financeira que vocês precisam tomar essa semana?`,
  ];
}

// Perguntas do fechamento mensal
function buildMonthlyQuestions(ctx: RevisaoContext): string[] {
  const pctPaid =
    ctx.billCount > 0 ? Math.round((ctx.paidCount / ctx.billCount) * 100) : 0;
  return [
    `${MONTHS_PT[ctx.month - 1]} está acabando. O que saiu diferente do planejado?`,
    `Vocês pagaram ${pctPaid}% das contas (${ctx.paidCount} de ${ctx.billCount}). O que ficou para o próximo mês?`,
    `Algum gasto se repetiu que não deveria? Qual categoria mais pesou?`,
    `Qual foi o maior aprendizado financeiro deste mês?`,
    `O que vocês querem fazer diferente em ${MONTHS_PT[ctx.month % 12]}?`,
  ];
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CheckinManager({
  context: ctx,
}: {
  context: RevisaoContext;
}) {
  const [mode, setMode] = useState<Mode>("home");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [decision, setDecision] = useState("");
  const [highlight, setHighlight] = useState("");
  const [improvement, setImprovement] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [doneWeekly, setDoneWeekly] = useState(ctx.doneThisWeek);
  const [doneMonthly, setDoneMonthly] = useState(ctx.doneThisMonth);

  const weeklyQuestions = buildWeeklyQuestions(ctx);
  const monthlyQuestions = buildMonthlyQuestions(ctx);

  const activeQuestions =
    mode === "weekly" ? weeklyQuestions : monthlyQuestions;
  const isLastStep = step === activeQuestions.length; // pós-perguntas = etapa de decisão

  function startMode(m: "weekly" | "monthly") {
    setMode(m);
    setStep(0);
    setAnswers([]);
    setDecision("");
    setHighlight("");
    setImprovement("");
    setSaved(false);
  }

  function handleAnswer(value: string) {
    const updated = [...answers];
    updated[step] = value;
    setAnswers(updated);
  }

  function next() {
    if (step < activeQuestions.length) setStep((s) => s + 1);
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function handleSave() {
    setSaving(true);
    const data: CheckinData = {
      answers: activeQuestions.map((q, i) => ({
        question: q,
        answer: answers[i] ?? "",
      })),
      decision: decision || undefined,
      highlight: highlight || undefined,
      improvement: improvement || undefined,
    };

    await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: mode, data }),
    });

    setSaving(false);
    setSaved(true);
    if (mode === "weekly") setDoneWeekly(true);
    if (mode === "monthly") setDoneMonthly(true);
  }

  // ── Tela inicial ─────────────────────────────────────────────────────────
  if (mode === "home") {
    return (
      <div className="space-y-5 max-w-2xl">
        {/* Contexto financeiro rápido */}
        <div className="card p-5">
          <h2
            className="text-sm font-black uppercase tracking-wide mb-4"
            style={{ fontFamily: "var(--font-display)", color: "#8dcdb0" }}
          >
            Situação de {MONTHS_PT[ctx.month - 1]}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ContextCard
              label="Total"
              value={BRL(ctx.totalBills)}
              color="#f0f9f4"
            />
            <ContextCard
              label="Pago"
              value={BRL(ctx.paidBills)}
              color="#5ab28d"
            />
            <ContextCard
              label="Pendente"
              value={BRL(ctx.pendingBills)}
              color="#f59e0b"
            />
            <ContextCard
              label="Saldo"
              value={BRL(ctx.balance)}
              color={ctx.balance >= 0 ? "#5ab28d" : "#ef4444"}
            />
          </div>
          {ctx.billCount > 0 && (
            <div className="mt-4">
              <div
                className="flex justify-between text-xs mb-1"
                style={{ color: "#4a6b58" }}
              >
                <span>
                  {ctx.paidCount}/{ctx.billCount} contas pagas
                </span>
                <span>
                  {Math.round((ctx.paidCount / ctx.billCount) * 100)}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "#2a3d31" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(ctx.paidCount / ctx.billCount) * 100}%`,
                    background: "#389671",
                  }}
                />
              </div>
            </div>
          )}
          {ctx.dueSoon.length > 0 && (
            <div
              className="mt-4 p-3 rounded-lg"
              style={{ background: "#2d1e0f", border: "1px solid #78350f" }}
            >
              <p
                className="text-xs font-semibold mb-2"
                style={{ color: "#f59e0b" }}
              >
                ⚠️ Vencendo em breve
              </p>
              {ctx.dueSoon.map((d) => (
                <div
                  key={d.name}
                  className="flex justify-between text-xs py-0.5"
                >
                  <span style={{ color: "#fcd34d" }}>{d.name}</span>
                  <span style={{ color: "#4a6b58" }}>
                    dia {d.dueDay} · {BRL(d.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cards de check-in */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Semanal */}
          <button
            onClick={() => startMode("weekly")}
            className="card p-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] space-y-3"
            style={{
              border: doneWeekly ? "1px solid #389671" : "1px solid #2a3d31",
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: doneWeekly ? "rgba(56,150,113,0.2)" : "#1c2b22",
                }}
              >
                <CalendarCheck
                  size={20}
                  color={doneWeekly ? "#5ab28d" : "#8dcdb0"}
                />
              </div>
              {doneWeekly ? (
                <CheckCircle2 size={18} color="#5ab28d" />
              ) : (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(245,158,11,0.15)",
                    color: "#f59e0b",
                  }}
                >
                  Pendente
                </span>
              )}
            </div>
            <div>
              <h3
                className="font-black text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Check-in semanal
              </h3>
              <p className="text-xs mt-1" style={{ color: "#4a6b58" }}>
                5 perguntas · ~5 min · semana {ctx.weekNumber}
              </p>
            </div>
            <p className="text-xs" style={{ color: "#8dcdb0" }}>
              {doneWeekly
                ? "Feito esta semana! Clique para revisar ou refazer."
                : "Como está indo? Revisem entradas, saídas e o que vence."}
            </p>
            <div
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#5ab28d" }}
            >
              {doneWeekly ? "Revisar" : "Iniciar"} <ChevronRight size={14} />
            </div>
          </button>

          {/* Mensal */}
          <button
            onClick={() => startMode("monthly")}
            className="card p-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] space-y-3"
            style={{
              border: doneMonthly ? "1px solid #389671" : "1px solid #2a3d31",
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: doneMonthly ? "rgba(56,150,113,0.2)" : "#1c2b22",
                }}
              >
                <ClipboardList
                  size={20}
                  color={doneMonthly ? "#5ab28d" : "#8dcdb0"}
                />
              </div>
              {doneMonthly ? (
                <CheckCircle2 size={18} color="#5ab28d" />
              ) : (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#1c2b22", color: "#4a6b58" }}
                >
                  1x/mês
                </span>
              )}
            </div>
            <div>
              <h3
                className="font-black text-base"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Fechamento mensal
              </h3>
              <p className="text-xs mt-1" style={{ color: "#4a6b58" }}>
                5 perguntas + decisão · ~10 min · {MONTHS_PT[ctx.month - 1]}
              </p>
            </div>
            <p className="text-xs" style={{ color: "#8dcdb0" }}>
              {doneMonthly
                ? "Já fecharam o mês! Clique para revisar."
                : "O que saiu do plano? O que aprenderam? O que muda?"}
            </p>
            <div
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#5ab28d" }}
            >
              {doneMonthly ? "Revisar" : "Iniciar"} <ChevronRight size={14} />
            </div>
          </button>
        </div>

        {/* Histórico recente */}
        {ctx.recentCheckins.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-black uppercase tracking-wide"
                style={{ fontFamily: "var(--font-display)", color: "#4a6b58" }}
              >
                Histórico recente
              </h3>
              <button
                onClick={() => setMode("history")}
                className="text-xs"
                style={{ color: "#5ab28d" }}
              >
                Ver tudo
              </button>
            </div>
            <div className="space-y-2">
              {ctx.recentCheckins.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2 border-b"
                  style={{ borderColor: "#2a3d31" }}
                >
                  <div className="flex items-center gap-2">
                    {c.type === "weekly" ? (
                      <CalendarCheck size={14} color="#8dcdb0" />
                    ) : (
                      <ClipboardList size={14} color="#c084fc" />
                    )}
                    <span className="text-xs" style={{ color: "#f0f9f4" }}>
                      {c.type === "weekly"
                        ? `Semana ${c.weekNumber}`
                        : `Fechamento ${MONTHS_PT[c.month - 1]}`}
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1 text-xs"
                    style={{ color: "#4a6b58" }}
                  >
                    <Clock size={11} />
                    {c.createdAt
                      ? new Date(c.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })
                      : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Histórico completo ──────────────────────────────────────────────────────
  if (mode === "history") {
    return (
      <div className="space-y-4 max-w-2xl">
        <button
          onClick={() => setMode("home")}
          className="flex items-center gap-1 text-sm"
          style={{ color: "#8dcdb0" }}
        >
          <ChevronLeft size={16} /> Voltar
        </button>
        <h2
          className="font-black text-lg"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Histórico de revisões
        </h2>
        {ctx.recentCheckins.length === 0 && (
          <div className="card p-8 text-center" style={{ color: "#4a6b58" }}>
            Nenhuma revisão registrada ainda.
          </div>
        )}
        <div className="space-y-3">
          {ctx.recentCheckins.map((c) => (
            <div key={c.id} className="card p-4 space-y-3">
              <div className="flex items-center gap-2">
                {c.type === "weekly" ? (
                  <CalendarCheck size={16} color="#8dcdb0" />
                ) : (
                  <ClipboardList size={16} color="#c084fc" />
                )}
                <span
                  className="font-semibold text-sm"
                  style={{ color: "#f0f9f4" }}
                >
                  {c.type === "weekly"
                    ? `Check-in — Semana ${c.weekNumber}/${c.year}`
                    : `Fechamento — ${MONTHS_PT[c.month - 1]} ${c.year}`}
                </span>
                <span className="ml-auto text-xs" style={{ color: "#4a6b58" }}>
                  {c.createdAt
                    ? new Date(c.createdAt).toLocaleDateString("pt-BR")
                    : "—"}
                </span>
              </div>
              {c.data.answers?.map((a, i) => (
                <div
                  key={i}
                  className="pl-3 border-l-2"
                  style={{ borderColor: "#2a3d31" }}
                >
                  <p className="text-xs mb-1" style={{ color: "#4a6b58" }}>
                    {a.question}
                  </p>
                  <p className="text-sm" style={{ color: "#8dcdb0" }}>
                    {a.answer || "—"}
                  </p>
                </div>
              ))}
              {c.data.decision && (
                <div
                  className="p-3 rounded-lg"
                  style={{ background: "#1c2b22" }}
                >
                  <p
                    className="text-xs font-semibold mb-1"
                    style={{ color: "#5ab28d" }}
                  >
                    🎯 Decisão do casal
                  </p>
                  <p className="text-sm" style={{ color: "#f0f9f4" }}>
                    {c.data.decision}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Flow de perguntas (weekly / monthly) ────────────────────────────────────
  const progress = ((step + 1) / (activeQuestions.length + 1)) * 100;
  const modeLabel =
    mode === "weekly" ? "Check-in semanal" : "Fechamento mensal";
  const modeColor = mode === "weekly" ? "#8dcdb0" : "#c084fc";
  const ModeIcon = mode === "weekly" ? CalendarCheck : ClipboardList;

  return (
    <div className="max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMode("home")} style={{ color: "#4a6b58" }}>
          <ChevronLeft size={20} />
        </button>
        <ModeIcon size={18} color={modeColor} />
        <span
          className="font-black text-sm"
          style={{ fontFamily: "var(--font-display)", color: modeColor }}
        >
          {modeLabel}
        </span>
        <span className="ml-auto text-xs" style={{ color: "#4a6b58" }}>
          {Math.min(step + 1, activeQuestions.length + 1)}/
          {activeQuestions.length + 1}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: "#2a3d31" }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${progress}%`, background: modeColor }}
        />
      </div>

      {/* Tela de conclusão (saved) */}
      {saved ? (
        <div className="card p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(56,150,113,0.2)" }}
            >
              <Sparkles size={32} color="#5ab28d" />
            </div>
          </div>
          <h3
            className="font-black text-xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {mode === "weekly" ? "Check-in feito! 🎉" : "Mês fechado! 🎉"}
          </h3>
          <p style={{ color: "#8dcdb0" }}>
            {mode === "weekly"
              ? "Boa conversa. Nos vemos semana que vem!"
              : "Ótimo fechamento. Sigam em frente com mais clareza!"}
          </p>
          {decision && (
            <div
              className="p-4 rounded-xl text-left"
              style={{ background: "#1c2b22", border: "1px solid #2a3d31" }}
            >
              <p
                className="text-xs font-semibold mb-1"
                style={{ color: "#5ab28d" }}
              >
                🎯 Decisão registrada
              </p>
              <p className="text-sm" style={{ color: "#f0f9f4" }}>
                {decision}
              </p>
            </div>
          )}
          <button
            onClick={() => setMode("home")}
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ background: "#389671", color: "#fff" }}
          >
            Voltar à Revisão
          </button>
        </div>
      ) : isLastStep ? (
        // ── Etapa final: decisão / highlight / improvement ──────────────────
        <div className="card p-5 space-y-5">
          <div>
            <h3
              className="font-black text-base mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {mode === "weekly"
                ? "🎯 Decisão desta semana"
                : "📝 Fechamento do mês"}
            </h3>
            <p className="text-xs" style={{ color: "#4a6b58" }}>
              {mode === "weekly"
                ? "Em uma frase: qual é a principal decisão financeira de vocês para essa semana?"
                : "Registrem o aprendizado e o que farão diferente."}
            </p>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
              style={{ color: modeColor }}
            >
              🎯{" "}
              {mode === "weekly"
                ? "Decisão da semana"
                : "Decisão para o próximo mês"}
            </label>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="input-base"
              style={{ minHeight: "80px", resize: "vertical" }}
              placeholder={
                mode === "weekly"
                  ? "Ex: não fazer novas compras parceladas essa semana"
                  : "Ex: reduzir gastos com lazer em R$ 200"
              }
            />
          </div>

          {mode === "monthly" && (
            <>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#8dcdb0" }}
                >
                  ✨ Maior aprendizado do mês
                </label>
                <textarea
                  value={highlight}
                  onChange={(e) => setHighlight(e.target.value)}
                  className="input-base"
                  style={{ minHeight: "70px", resize: "vertical" }}
                  placeholder="Ex: percebemos que delivery é nossa maior categoria variável"
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5 uppercase tracking-wide"
                  style={{ color: "#8dcdb0" }}
                >
                  🔧 O que melhorar em {MONTHS_PT[ctx.month % 12]}
                </label>
                <textarea
                  value={improvement}
                  onChange={(e) => setImprovement(e.target.value)}
                  className="input-base"
                  style={{ minHeight: "70px", resize: "vertical" }}
                  placeholder="Ex: lançar as contas toda segunda-feira"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={prev}
              className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "#1c2b22",
                color: "#8dcdb0",
                border: "1px solid #2a3d31",
              }}
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "#389671", color: "#fff" }}
            >
              {saving ? "Salvando..." : "Concluir revisão ✓"}
            </button>
          </div>
        </div>
      ) : (
        // ── Pergunta atual ──────────────────────────────────────────────────
        <div className="card p-5 space-y-5">
          <div>
            <p
              className="text-xs font-semibold mb-3 uppercase tracking-wide"
              style={{ color: modeColor }}
            >
              Pergunta {step + 1} de {activeQuestions.length}
            </p>
            <h3
              className="text-base font-semibold leading-relaxed"
              style={{ color: "#f0f9f4" }}
            >
              {activeQuestions[step]}
            </h3>
          </div>

          <textarea
            value={answers[step] ?? ""}
            onChange={(e) => handleAnswer(e.target.value)}
            className="input-base"
            style={{ minHeight: "120px", resize: "vertical" }}
            placeholder="Respondam juntos, com honestidade..."
            autoFocus
          />

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: "#1c2b22",
                  color: "#8dcdb0",
                  border: "1px solid #2a3d31",
                }}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
            )}
            <button
              onClick={next}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "#389671", color: "#fff" }}
            >
              {step === activeQuestions.length - 1
                ? "Próximo passo"
                : "Próxima"}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContextCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="card-elevated rounded-xl p-3">
      <div
        className="text-xs mb-1 uppercase tracking-wide"
        style={{ color: "#4a6b58" }}
      >
        {label}
      </div>
      <div className="text-sm font-bold font-numeric" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
