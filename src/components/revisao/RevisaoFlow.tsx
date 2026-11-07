"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { BILL_CATEGORIES } from "@/lib/db/schema";
import { BRL, MONTHS, formatDateBR, todayISO } from "@/lib/month";
import type { CheckinData, GateMode, RevisaoContext, Scores } from "@/lib/revisao";

type StepKey = "conferir" | "limites" | "dividas" | "investimentos" | "futuras" | "termometro" | "decisao";

const STEP_TITLE: Record<StepKey, string> = {
  conferir: "Conferir a semana",
  limites: "Limites estourados",
  dividas: "Dívidas",
  investimentos: "Investimentos",
  futuras: "Futuras",
  termometro: "Termômetro",
  decisao: "Decisão",
};

const SCORE_LABELS: { key: keyof Scores; label: string; low: string; high: string }[] = [
  { key: "controle", label: "Controle dos gastos", low: "sem controle", high: "no controle" },
  { key: "preocupacaoDividas", label: "Preocupação com dívidas", low: "tranquilo", high: "muito preocupado" },
  { key: "confianca", label: "Confiança no fim do mês", low: "não fecha", high: "fecha com folga" },
];

// Formulário da Revisão: um passo curto por tela, chega pré-preenchido.
export default function RevisaoFlow({
  context,
  mode,
  onDone,
  onCancel,
}: Readonly<{
  context: RevisaoContext;
  mode: GateMode;
  onDone: () => void;
  onCancel?: () => void;
}>) {
  const steps: StepKey[] = [
    "conferir",
    ...(context.overLimit.length > 0 ? (["limites"] as const) : []),
    ...(mode === "monthly" && context.debts.length > 0 ? (["dividas"] as const) : []),
    ...(mode === "monthly" && context.manualInvestments.length > 0 ? (["investimentos"] as const) : []),
    "futuras",
    "termometro",
    "decisao",
  ];
  const [step, setStep] = useState(0);
  const current = steps[step];

  // Passo 1 — contas da semana (marcar pago direto daqui)
  const [bills, setBills] = useState(context.weekBills);
  // Passo 1 — transações do banco sem categoria (Pluggy/importação): categoria sugerida, confirmar em lote
  const [txCategories, setTxCategories] = useState<Record<number, string>>(
    Object.fromEntries(context.uncategorized.map((t) => [t.id, t.category ?? ""])),
  );
  const [ignoredTx, setIgnoredTx] = useState<Set<number>>(new Set());
  // Passo 2 — saldo devedor confirmado por dívida
  const [debtValues, setDebtValues] = useState<Record<number, string>>(
    Object.fromEntries(context.debts.map((d) => [d.id, d.remaining.toFixed(2).replace(".", ",")])),
  );
  // Passo 2b — saldo atual dos investimentos manuais
  const [investValues, setInvestValues] = useState<Record<number, string>>(
    Object.fromEntries(context.manualInvestments.map((i) => [i.id, i.balance.toFixed(2).replace(".", ",")])),
  );
  // Passo 3 — novas futuras
  const [futureName, setFutureName] = useState("");
  const [futureAmount, setFutureAmount] = useState("");
  const [futureDate, setFutureDate] = useState("");
  const [newFutures, setNewFutures] = useState<{ name: string; amount: number | null; reminderDate: string | null }[]>([]);
  // Passo 4 e 5
  const [scores, setScores] = useState<Scores>({ controle: 3, preocupacaoDividas: 3, confianca: 3 });
  const [decision, setDecision] = useState("");
  const [kept, setKept] = useState<boolean | null>(null);
  const [highlight, setHighlight] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function togglePaid(id: number) {
    const bill = bills.find((b) => b.id === id);
    if (!bill) return;
    const isPaid = !bill.isPaid;
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, isPaid } : b)));
    await fetch(`/api/bills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isPaid ? { isPaid, date: todayISO() } : { isPaid }),
    });
  }

  function addFuture() {
    if (!futureName.trim()) return;
    const parsed = Number.parseFloat(futureAmount.replace(",", "."));
    setNewFutures((prev) => [
      ...prev,
      {
        name: futureName.trim().toUpperCase(),
        amount: Number.isFinite(parsed) ? parsed : null,
        reminderDate: futureDate || null,
      },
    ]);
    setFutureName("");
    setFutureAmount("");
    setFutureDate("");
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      // Transações: agrupa por categoria para um PATCH por grupo; ignoradas saem da fila.
      if (context.uncategorized.length > 0) {
        const groups = new Map<string, number[]>();
        for (const t of context.uncategorized) {
          if (ignoredTx.has(t.id)) continue;
          const cat = txCategories[t.id] || "outros";
          groups.set(cat, [...(groups.get(cat) ?? []), t.id]);
        }
        for (const [category, ids] of Array.from(groups.entries())) {
          await fetch("/api/bank-transactions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids, action: "categorize", category }),
          });
        }
        if (ignoredTx.size > 0) {
          await fetch("/api/bank-transactions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: Array.from(ignoredTx), action: "ignore" }),
          });
        }
      }

      // Dívidas: saldo devedor confirmado → novo total = pago + saldo (alimenta history_debts)
      if (mode === "monthly") {
        for (const d of context.debts) {
          const confirmed = Number.parseFloat((debtValues[d.id] ?? "").replace(/\./g, "").replace(",", "."));
          if (!Number.isFinite(confirmed) || Math.abs(confirmed - d.remaining) < 0.01) continue;
          await fetch("/api/history-debts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ debtId: d.id, newAmount: d.paid + confirmed, reason: "Revisão mensal" }),
          });
        }
      }

      if (mode === "monthly") {
        for (const inv of context.manualInvestments) {
          const value = Number.parseFloat((investValues[inv.id] ?? "").replace(/\./g, "").replace(",", "."));
          if (!Number.isFinite(value) || Math.abs(value - inv.balance) < 0.01) continue;
          await fetch("/api/investments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: inv.id, balance: value }),
          });
        }
      }

      for (const f of newFutures) {
        await fetch("/api/future-bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(f),
        });
      }

      const data: CheckinData = {
        scores,
        decision: decision.trim() || undefined,
        previousDecisionKept: context.previousDecision ? kept : null,
        highlight: highlight.trim() || undefined,
        answers: [],
      };
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, data }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  const reviewedLabel =
    mode === "monthly"
      ? `Fechamento de ${MONTHS[context.status.month.month - 1]}`
      : `Semana ${formatDateBR(context.status.week.start).slice(0, 5)} a ${formatDateBR(context.status.week.end).slice(0, 5)}`;

  if (saved) {
    return (
      <div className="text-center space-y-4 py-4">
        <div
          className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
          style={{ background: "rgb(var(--accent-strong) / 0.15)" }}
        >
          <Sparkles size={26} style={{ color: "rgb(var(--accent))" }} />
        </div>
        <div>
          <h3 className="text-lg font-bold">{mode === "monthly" ? "Mês fechado" : "Revisão feita"}</h3>
          <p className="text-sm mt-1" style={{ color: "rgb(var(--text-soft))" }}>
            Os números de hoje ficaram guardados para comparar na Evolução.
          </p>
        </div>
        {decision && (
          <div className="p-3 rounded-xl text-left" style={{ background: "rgb(var(--surface-raised))" }}>
            <div className="label-sm mb-1">Decisão da semana</div>
            <p className="text-sm">{decision}</p>
          </div>
        )}
        <button
          onClick={onDone}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
        >
          Continuar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-xs" style={{ color: "rgb(var(--text-muted))" }}>
          <span>{reviewedLabel}</span>
          <span className="tabular">
            {step + 1}/{steps.length}
          </span>
        </div>
        <div className="flex gap-1 mt-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ background: i <= step ? "rgb(var(--accent))" : "rgb(var(--border))" }}
            />
          ))}
        </div>
        <h3 className="text-lg font-bold mt-4">{STEP_TITLE[current]}</h3>
      </div>

      {current === "conferir" && (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
            Contas que venceram na semana e as que seguem em aberto. Marque o que já foi pago.
          </p>
          {bills.length === 0 ? (
            <p className="text-sm py-3" style={{ color: "rgb(var(--text-muted))" }}>
              Nenhuma conta venceu nesse período.
            </p>
          ) : (
            <ul className="divide-y divide-line max-h-72 overflow-y-auto">
              {bills.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => togglePaid(b.id)}
                    aria-label={b.isPaid ? "Desmarcar pago" : "Marcar como pago"}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: b.isPaid ? "rgb(var(--accent-strong))" : "rgb(var(--border))",
                      background: b.isPaid ? "rgb(var(--accent-strong))" : "transparent",
                    }}
                  >
                    {b.isPaid && <Check size={12} strokeWidth={3} color="rgb(var(--on-accent))" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: b.isPaid ? "rgb(var(--text-muted))" : "rgb(var(--text))" }}>
                      {b.name}
                    </div>
                    {b.dueDate && (
                      <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                        venceu {formatDateBR(b.dueDate)}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-numeric">{BRL(b.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          {context.uncategorized.length > 0 && (
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="label-sm">A categorizar ({context.uncategorized.length - ignoredTx.size})</div>
                <span className="text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                  confirma tudo ao concluir
                </span>
              </div>
              <ul className="divide-y divide-line max-h-64 overflow-y-auto">
                {context.uncategorized.map((t) => {
                  const ignored = ignoredTx.has(t.id);
                  return (
                    <li key={t.id} className="flex items-center gap-2 py-2" style={{ opacity: ignored ? 0.45 : 1 }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{t.description}</div>
                        <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
                          {formatDateBR(t.date)}
                          {t.accountName ? ` · ${t.accountName}` : ""}
                        </div>
                      </div>
                      <span className="text-sm font-numeric">{BRL(Math.abs(t.amount))}</span>
                      <select
                        value={txCategories[t.id] ?? ""}
                        disabled={ignored}
                        onChange={(e) => setTxCategories((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        className="text-xs rounded-lg px-1.5 py-1 w-28"
                        style={{ background: "rgb(var(--surface-raised))", border: "1px solid rgb(var(--border))", color: "rgb(var(--text))" }}
                        aria-label="Categoria"
                      >
                        <option value="">outros</option>
                        {BILL_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          setIgnoredTx((prev) => {
                            const next = new Set(prev);
                            if (next.has(t.id)) next.delete(t.id);
                            else next.add(t.id);
                            return next;
                          })
                        }
                        className="text-[11px] font-semibold px-1.5"
                        style={{ color: "rgb(var(--text-muted))" }}
                      >
                        {ignored ? "voltar" : "ignorar"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {context.staleImports.length > 0 && (
            <div
              className="text-xs p-3 rounded-lg"
              style={{ background: "rgb(var(--warning-bg))", color: "rgb(var(--warning-soft))", border: "1px solid rgb(var(--warning-border))" }}
            >
              Extrato sem importar há mais de 7 dias: {context.staleImports.map((a) => a.name).join(", ")}. Importe em
              Patrimônio › Contas.
            </div>
          )}
        </div>
      )}

      {current === "limites" && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
            Onde o mês passou do combinado, e quais lançamentos pesaram. Use isso na decisão da semana.
          </p>
          {context.overLimit.map((o) => (
            <div key={o.key} className="rounded-xl p-3 space-y-2" style={{ border: "1px solid rgb(var(--negative) / 0.35)" }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{o.label}</span>
                <span className="text-sm font-numeric" style={{ color: "rgb(var(--negative))" }}>
                  {BRL(o.spent)}
                  <span className="text-xs font-normal" style={{ color: "rgb(var(--text-muted))" }}>
                    {" "}/ {BRL(o.limit)}
                  </span>
                </span>
              </div>
              <div className="text-xs" style={{ color: "rgb(var(--negative))" }}>
                {BRL(o.spent - o.limit)} acima do limite
              </div>
              <ul className="divide-y divide-line max-h-56 overflow-y-auto">
                {o.lines.map((l, i) => (
                  <li key={i} className="flex items-center gap-2 py-1.5 text-xs">
                    <span className="flex-1 min-w-0 truncate">{l.name}</span>
                    <span style={{ color: "rgb(var(--text-muted))" }}>
                      {l.source === "conta" ? "conta" : l.origin ?? l.source}
                      {l.date ? ` · ${formatDateBR(l.date).slice(0, 5)}` : ""}
                    </span>
                    <span className="font-numeric">{BRL(l.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {current === "dividas" && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
            Confirme o saldo devedor de cada dívida hoje. Se mudou, o histórico registra.
          </p>
          {context.debts.map((d) => (
            <label key={d.id} className="flex items-center gap-3">
              <span className="flex-1 min-w-0 text-sm truncate">{d.name}</span>
              <input
                inputMode="decimal"
                value={debtValues[d.id] ?? ""}
                onChange={(e) => setDebtValues((prev) => ({ ...prev, [d.id]: e.target.value }))}
                className="input-base !w-36 text-right tabular"
              />
            </label>
          ))}
        </div>
      )}

      {current === "investimentos" && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
            Atualize o saldo de hoje dos investimentos cadastrados à mão.
          </p>
          {context.manualInvestments.map((i) => (
            <label key={i.id} className="flex items-center gap-3">
              <span className="flex-1 min-w-0 text-sm truncate">{i.name}</span>
              <input
                inputMode="decimal"
                value={investValues[i.id] ?? ""}
                onChange={(e) => setInvestValues((prev) => ({ ...prev, [i.id]: e.target.value }))}
                className="input-base !w-36 text-right tabular"
              />
            </label>
          ))}
        </div>
      )}

      {current === "futuras" && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "rgb(var(--text-soft))" }}>
            Algo que vai cair nas próximas semanas e não está aqui?
          </p>
          {(context.futures.length > 0 || newFutures.length > 0) && (
            <ul className="space-y-1.5">
              {[...context.futures, ...newFutures].map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex justify-between text-sm px-3 py-2 rounded-lg"
                  style={{ border: "1px dashed rgb(var(--border))" }}
                >
                  <span className="truncate">{f.name}</span>
                  <span style={{ color: "rgb(var(--text-muted))" }}>
                    {f.reminderDate ? formatDateBR(f.reminderDate.slice(0, 10)) : ""} {f.amount ? `· ${BRL(f.amount)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input
              value={futureName}
              onChange={(e) => setFutureName(e.target.value)}
              placeholder="IPVA, presente, matrícula..."
              className="input-base col-span-2"
            />
            <input
              type="date"
              value={futureDate}
              onChange={(e) => setFutureDate(e.target.value)}
              className="input-base"
              aria-label="Data do lembrete"
            />
            <input
              inputMode="decimal"
              value={futureAmount}
              onChange={(e) => setFutureAmount(e.target.value)}
              placeholder="Valor"
              className="input-base text-right"
            />
          </div>
          <button
            onClick={addFuture}
            disabled={!futureName.trim()}
            className="flex items-center gap-1.5 text-sm font-semibold disabled:opacity-50"
            style={{ color: "rgb(var(--accent))" }}
          >
            <Plus size={15} /> Adicionar previsto
          </button>
        </div>
      )}

      {current === "termometro" && (
        <div className="space-y-5">
          {SCORE_LABELS.map((s) => (
            <div key={s.key}>
              <div className="text-sm font-semibold mb-2">{s.label}</div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = scores[s.key] === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setScores((prev) => ({ ...prev, [s.key]: n }))}
                      className="py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: active ? "rgb(var(--accent-strong))" : "rgb(var(--surface-raised))",
                        color: active ? "rgb(var(--on-accent))" : "rgb(var(--text-soft))",
                        border: `1px solid ${active ? "rgb(var(--accent-strong))" : "rgb(var(--border))"}`,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[11px] mt-1" style={{ color: "rgb(var(--text-muted))" }}>
                <span>{s.low}</span>
                <span>{s.high}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {current === "decisao" && (
        <div className="space-y-4">
          {context.previousDecision && (
            <div className="p-3 rounded-xl space-y-2" style={{ background: "rgb(var(--surface-raised))" }}>
              <div className="label-sm">Decisão anterior</div>
              <p className="text-sm">{context.previousDecision}</p>
              <div className="flex gap-2">
                {[
                  { v: true, label: "Cumpri" },
                  { v: false, label: "Não cumpri" },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setKept(o.v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: kept === o.v ? "rgb(var(--accent-strong))" : "rgb(var(--surface))",
                      color: kept === o.v ? "rgb(var(--on-accent))" : "rgb(var(--text-soft))",
                      border: "1px solid rgb(var(--border))",
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold block mb-1.5" htmlFor="revisao-decision">
              Uma decisão para a próxima semana
            </label>
            <textarea
              id="revisao-decision"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              className="input-base"
              style={{ minHeight: 80, resize: "vertical" }}
              placeholder="Ex.: não usar o cartão para lazer"
            />
          </div>
          {mode === "monthly" && (
            <div>
              <label className="text-sm font-semibold block mb-1.5" htmlFor="revisao-highlight">
                O que o mês ensinou?
              </label>
              <textarea
                id="revisao-highlight"
                value={highlight}
                onChange={(e) => setHighlight(e.target.value)}
                className="input-base"
                style={{ minHeight: 70, resize: "vertical" }}
              />
            </div>
          )}
          {error && (
            <p className="text-sm" style={{ color: "rgb(var(--negative))" }}>
              {error}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        {step > 0 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))", border: "1px solid rgb(var(--border))" }}
          >
            <ChevronLeft size={16} /> Voltar
          </button>
        ) : (
          onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))", border: "1px solid rgb(var(--border))" }}
            >
              Cancelar
            </button>
          )
        )}
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
          >
            Próximo <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
          >
            {saving ? "Salvando..." : "Concluir revisão"}
          </button>
        )}
      </div>
    </div>
  );
}
