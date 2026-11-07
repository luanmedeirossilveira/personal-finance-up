"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lightbulb, ThumbsDown, ThumbsUp, X } from "lucide-react";
import ProgressRing from "@/components/ui/ProgressRing";
import { BRL, formatDateBR, statusColor, todayISO } from "@/lib/month";
import type { MatchSuggestion, TodayData, UpcomingItem } from "@/lib/today";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: "corrente",
  savings: "poupança",
  credit: "cartão",
  meal: "alimentação",
};

function syncedAgo(iso: string | null) {
  if (!iso) return "manual";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `sincronizado há ${Math.max(mins, 1)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `sincronizado há ${hours}h`;
  return `sincronizado em ${new Date(iso).toLocaleDateString("pt-BR")}`;
}

const TONE_COLOR = {
  positive: "rgb(var(--accent))",
  warning: "rgb(var(--warning))",
  negative: "rgb(var(--negative))",
} as const;

function relativeDay(date: string) {
  const today = todayISO();
  if (date === today) return "hoje";
  const diff = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
  if (diff === 1) return "amanhã";
  if (diff < 0) return `há ${-diff}d`;
  return `em ${diff}d`;
}

// Tela Hoje (ex-Dashboard): frase-resumo, próximos 7 dias, três anéis e um insight.
export default function TodayView({ data }: Readonly<{ data: TodayData }>) {
  const router = useRouter();
  const [paying, setPaying] = useState<number | null>(null);
  const [paid, setPaid] = useState<Set<number>>(new Set());
  const [handled, setHandled] = useState<Set<number>>(new Set());
  const [vote, setVote] = useState<number | null>(data.insight?.vote ?? null);

  async function resolveSuggestion(s: MatchSuggestion, action: "confirm" | "reject") {
    setHandled((prev) => new Set(prev).add(s.txId));
    const res = await fetch("/api/bank-transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [s.txId], action }),
    });
    if (res.ok && action === "confirm") {
      setPaid((prev) => new Set(prev).add(s.billId));
      router.refresh();
    }
  }

  async function voteInsight(v: 1 | -1) {
    if (!data.insight?.id) return;
    const next = vote === v ? null : v;
    setVote(next);
    await fetch("/api/insights", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data.insight.id, vote: next }),
    });
  }

  const suggestions = data.suggestions.filter((s) => !handled.has(s.txId));

  async function pay(item: UpcomingItem) {
    setPaying(item.id);
    const res = await fetch(`/api/bills/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: true, date: todayISO() }),
    });
    setPaying(null);
    if (res.ok) {
      setPaid((prev) => new Set(prev).add(item.id));
      router.refresh();
    }
  }

  const upcoming = data.upcoming.filter((u) => !(u.kind === "bill" && paid.has(u.id)));
  const next = upcoming.find((u) => !u.overdue);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-6 min-w-0">
        {/* 1. Frase-resumo */}
        <section>
          <p className="text-xl md:text-2xl font-bold leading-snug text-balance">{data.summary}</p>
          <p className="text-sm mt-1" style={{ color: "rgb(var(--text-muted))" }}>
            Referente a {data.period.label} ·{" "}
            <Link href="/mes" className="underline underline-offset-2" style={{ color: "rgb(var(--accent))" }}>
              abrir o mês
            </Link>
          </p>
        </section>

        {/* Painel de resumo: vira o topo de Hoje no mobile */}
        <div className="xl:hidden">
          <SummaryPanel data={data} nextName={next?.name} nextDate={next?.dueDate} compact />
        </div>

        {/* 2. Saldo por conta (Pluggy ou manual) */}
        {data.accounts.length > 0 && (
          <section className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Saldo por conta</h2>
              <Link href="/patrimonio?tab=contas" className="text-xs font-semibold" style={{ color: "rgb(var(--accent))" }}>
                ver todas
              </Link>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.accounts.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgb(var(--surface-raised))" }}>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{a.name}</div>
                    <div className="text-[11px]" style={{ color: "rgb(var(--text-muted))" }}>
                      {ACCOUNT_TYPE_LABEL[a.type] ?? a.type} · {syncedAgo(a.lastSyncAt)}
                    </div>
                  </div>
                  <span className="text-sm font-numeric" style={{ color: a.balance < 0 ? "rgb(var(--negative))" : "rgb(var(--text))" }}>
                    {BRL(a.balance)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Cartões: uso no mês contra o planejado; fatura em aberto quando vem do banco */}
        {data.cards.length > 0 && (
          <section className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Cartões</h2>
              <Link href="/mes?tab=categorias" className="text-xs font-semibold" style={{ color: "rgb(var(--accent))" }}>
                ajustar planejado
              </Link>
            </div>
            <ul className="space-y-3">
              {data.cards.map((c) => {
                const color = c.ratio === null ? "rgb(var(--text-muted))" : statusColor(c.ratio);
                return (
                  <li key={`${c.id ?? c.name}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold">{c.name}</span>
                        <span className="text-xs ml-1.5" style={{ color: "rgb(var(--text-muted))" }}>
                          {c.ownership === "hers" ? "dela" : c.ownership === "joint" ? "conjunto" : "seu"}
                        </span>
                      </div>
                      <span className="text-sm font-numeric" style={{ color: c.ratio !== null && c.ratio > 1 ? "rgb(var(--negative))" : "rgb(var(--text))" }}>
                        {BRL(c.used)}
                        {c.monthlyLimit > 0 && (
                          <span className="text-xs font-normal" style={{ color: "rgb(var(--text-muted))" }}>
                            {" "}/ {BRL(c.monthlyLimit)}
                          </span>
                        )}
                      </span>
                    </div>
                    {c.monthlyLimit > 0 && (
                      <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgb(var(--border))" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min((c.ratio ?? 0) * 100, 100)}%`, background: color }} />
                      </div>
                    )}
                    <div className="text-xs mt-1" style={{ color: "rgb(var(--text-muted))" }}>
                      {c.monthlyLimit > 0
                        ? c.ratio !== null && c.ratio > 1
                          ? `${BRL(c.used - c.monthlyLimit)} acima do planejado`
                          : `restam ${BRL(c.monthlyLimit - c.used)} do planejado`
                        : "sem limite planejado"}
                      {c.openBill && ` · fatura em aberto ${BRL(c.openBill.amount)}${c.openBill.dueDate ? `, vence ${formatDateBR(c.openBill.dueDate).slice(0, 5)}` : ""}`}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Pagamentos detectados no banco: confirmar em vez de digitar */}
        {suggestions.length > 0 && (
          <section className="card p-4 md:p-5 space-y-2" style={{ borderLeft: "3px solid rgb(var(--accent))" }}>
            <h2 className="text-base font-bold">Pagamentos detectados</h2>
            {suggestions.map((s) => (
              <div key={s.txId} className="flex items-center gap-3 py-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.billName}</div>
                  <div className="text-xs truncate" style={{ color: "rgb(var(--text-muted))" }}>
                    {formatDateBR(s.date)} · {s.description}
                  </div>
                </div>
                <span className="text-sm font-numeric">{BRL(s.amount)}</span>
                <button
                  onClick={() => resolveSuggestion(s, "confirm")}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
                >
                  <Check size={13} strokeWidth={3} /> Paga
                </button>
                <button
                  onClick={() => resolveSuggestion(s, "reject")}
                  aria-label="Não é esta conta"
                  className="p-1.5 rounded-lg hover:bg-fg/5"
                  style={{ color: "rgb(var(--text-muted))" }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </section>
        )}

        {/* 3. Próximos 7 dias */}
        <section className="card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Próximos 7 dias</h2>
            <span className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              {upcoming.length === 0 ? "nada a vencer" : `${upcoming.length} item${upcoming.length > 1 ? "s" : ""}`}
            </span>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm py-2" style={{ color: "rgb(var(--text-muted))" }}>
              Nenhuma conta ou lembrete na próxima semana.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((u) => (
                <li key={`${u.kind}-${u.id}`} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: u.kind === "future" ? "rgb(var(--text-soft))" : "rgb(var(--text))" }}
                    >
                      {u.name}
                      {u.kind === "future" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md" style={{ border: "1px dashed rgb(var(--border))", color: "rgb(var(--text-muted))" }}>
                          previsto
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: u.overdue ? "rgb(var(--negative))" : "rgb(var(--text-muted))" }}>
                      {u.overdue ? "vencida" : "vence"} {relativeDay(u.dueDate)} · {formatDateBR(u.dueDate)}
                    </div>
                  </div>
                  <span className="text-sm font-numeric">{u.amount ? BRL(u.amount) : "—"}</span>
                  {u.kind === "bill" ? (
                    <button
                      onClick={() => pay(u)}
                      disabled={paying === u.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-60"
                      style={{ background: "rgb(var(--accent-strong))", color: "rgb(var(--on-accent))" }}
                    >
                      <Check size={13} strokeWidth={3} /> Pagar
                    </button>
                  ) : (
                    <Link
                      href="/mes"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: "rgb(var(--surface-raised))", color: "rgb(var(--text-soft))", border: "1px solid rgb(var(--border))" }}
                    >
                      Ver
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. Três anéis com significado */}
        {data.rings.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-3">
            {data.rings.map((r) => {
              // Contas pagas e aporte: quanto mais, melhor. Orçamento: quanto menos, melhor.
              const color =
                r.key === "budget" ? statusColor(r.value) : r.value >= 1 ? "rgb(var(--accent))" : "rgb(var(--text-soft))";
              return (
                <div key={r.key} className="card p-4 flex items-center gap-4">
                  <ProgressRing value={r.value} color={color} size={76} stroke={7} />
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{r.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "rgb(var(--text-muted))" }}>
                      {r.caption}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* 5. Um insight da semana */}
        {data.insight && (
          <section
            className="card p-4 md:p-5 flex gap-3"
            style={{ borderLeft: `3px solid ${TONE_COLOR[data.insight.tone]}` }}
          >
            <Lightbulb size={20} className="flex-shrink-0 mt-0.5" style={{ color: TONE_COLOR[data.insight.tone] }} />
            <div className="min-w-0">
              <div className="text-sm font-bold">{data.insight.title}</div>
              <p className="text-sm mt-1" style={{ color: "rgb(var(--text-soft))" }}>
                {data.insight.message}
              </p>
              {data.insight.action && (
                <p className="text-sm mt-1" style={{ color: "rgb(var(--text))" }}>
                  → {data.insight.action}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <Link
                  href="/revisao"
                  className="inline-flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "rgb(var(--accent))" }}
                >
                  Abrir a Revisão <ArrowRight size={12} />
                </Link>
                {data.insight.id && (
                  <span className="ml-auto flex items-center gap-1">
                    <span className="text-[11px] mr-1" style={{ color: "rgb(var(--text-muted))" }}>
                      útil?
                    </span>
                    {([1, -1] as const).map((v) => {
                      const Icon = v === 1 ? ThumbsUp : ThumbsDown;
                      return (
                        <button
                          key={v}
                          onClick={() => voteInsight(v)}
                          aria-label={v === 1 ? "Útil" : "Não útil"}
                          aria-pressed={vote === v}
                          className="p-1.5 rounded-lg hover:bg-fg/5"
                          style={{ color: vote === v ? "rgb(var(--accent))" : "rgb(var(--text-muted))" }}
                        >
                          <Icon size={14} />
                        </button>
                      );
                    })}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Painel lateral (≥ 1280px) */}
      <aside className="hidden xl:block">
        <div className="sticky top-8">
          <SummaryPanel data={data} nextName={next?.name} nextDate={next?.dueDate} />
        </div>
      </aside>
    </div>
  );
}

function SummaryPanel({
  data,
  nextName,
  nextDate,
  compact = false,
}: Readonly<{ data: TodayData; nextName?: string; nextDate?: string; compact?: boolean }>) {
  const items = [
    {
      label: "Saldo projetado",
      value: BRL(data.projected),
      color: data.projected >= 0 ? "rgb(var(--accent))" : "rgb(var(--negative))",
      note: `${BRL(data.income)} de entradas`,
    },
    {
      label: "Em aberto",
      value: BRL(data.pendingTotal),
      color: "rgb(var(--text))",
      note: `${data.pendingCount} conta${data.pendingCount === 1 ? "" : "s"}`,
    },
    {
      label: "Dívida total",
      value: BRL(data.debtTotal),
      color: data.debtTotal > 0 ? "rgb(var(--warning))" : "rgb(var(--text))",
      note: "ver em Patrimônio",
      href: "/patrimonio?tab=dividas",
    },
  ];

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.label} className="card px-3 py-3 min-w-0">
            <div className="label-sm truncate">{i.label}</div>
            <div className="text-sm sm:text-base font-numeric mt-1 truncate" style={{ color: i.color }}>
              {i.value}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-5">
      <h2 className="text-base font-bold">Resumo</h2>
      {items.map((i) => {
        const body = (
          <>
            <div className="label-sm">{i.label}</div>
            <div className="text-2xl font-numeric mt-1" style={{ color: i.color }}>
              {i.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgb(var(--text-muted))" }}>
              {i.note}
            </div>
          </>
        );
        return i.href ? (
          <Link key={i.label} href={i.href} className="block hover:opacity-80">
            {body}
          </Link>
        ) : (
          <div key={i.label}>{body}</div>
        );
      })}
      <div className="pt-4" style={{ borderTop: "1px solid rgb(var(--border))" }}>
        <div className="label-sm">Próxima conta</div>
        {nextName && nextDate ? (
          <div className="mt-1">
            <div className="text-sm font-semibold truncate">{nextName}</div>
            <div className="text-xs" style={{ color: "rgb(var(--text-muted))" }}>
              {relativeDay(nextDate)} · {formatDateBR(nextDate)}
            </div>
          </div>
        ) : (
          <div className="text-sm mt-1" style={{ color: "rgb(var(--text-muted))" }}>
            Nada nos próximos 7 dias
          </div>
        )}
      </div>
    </div>
  );
}
