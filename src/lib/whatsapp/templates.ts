// Respostas do assistente montadas por código: números sempre vêm do banco, nunca do modelo.
// WhatsApp: *negrito*, no máximo ~10 linhas, emoji só como marcador.
import { categoryLabel } from "@/lib/categories";
import { BRL, type MonthSummary } from "@/lib/month";
import type { UpcomingItem } from "@/lib/upcoming";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MAX_ITEMS = 8;

// "hoje", "amanhã", "ontem" ou "seg 24/11" (relativo ao dia de hoje em São Paulo).
export function relativeDate(iso: string, today: Date) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((date.getTime() - base.getTime()) / 86_400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  return `${WEEKDAYS[date.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

const moreLine = (total: number) => (total > MAX_ITEMS ? [`…e mais ${total - MAX_ITEMS}`] : []);

export function monthSummaryReply(label: string, s: MonthSummary, closed = false) {
  return [
    `*${label}*${closed ? " (fechado)" : ""}`,
    `Entradas: ${BRL(s.income)}`,
    `Saídas: ${BRL(s.outflow)}`,
    ...(s.invested > 0 ? [`Investido: ${BRL(s.invested)}`] : []),
    ...(s.pending > 0 ? [`A pagar: ${BRL(s.pending)} (${s.pendingCount} conta${s.pendingCount > 1 ? "s" : ""})`] : []),
    `Saldo previsto: *${BRL(s.balance)}*`,
  ].join("\n");
}

const limitNote = (spent: number, limit: number | undefined) =>
  limit && limit > 0 ? ` (${Math.round((spent / limit) * 100)}% do limite)` : "";

export function categorySpendingReply(label: string, category: string, spent: number, limit?: number) {
  const lines = [`*${categoryLabel(category)}* em ${label}: *${BRL(spent)}*`];
  if (limit && limit > 0) {
    const left = limit - spent;
    lines.push(
      `Limite: ${BRL(limit)}${limitNote(spent, limit)}`,
      left >= 0 ? `Sobram ${BRL(left)}` : `⚠️ ${BRL(-left)} acima do limite`,
    );
  }
  return lines.join("\n");
}

export function topCategoriesReply(label: string, byCategory: Record<string, number>, limits: Record<string, number>) {
  const entries = Object.entries(byCategory)
    .filter(([, v]) => v > 0.009)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return `Nenhum gasto lançado em ${label} ainda.`;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return [
    `*Gastos de ${label}*`,
    ...entries.slice(0, 5).map(([c, v], i) => `${i + 1}. ${categoryLabel(c)}: ${BRL(v)}${limitNote(v, limits[c])}`),
    `Total: *${BRL(total)}*`,
  ].join("\n");
}

export function upcomingReply(items: UpcomingItem[], days: number, today: Date) {
  const period = days === 1 ? "hoje e amanhã" : `nos próximos ${days} dias`;
  if (items.length === 0) return `Nada vencendo ${period} ✅`;
  return [
    `*Vencem ${period}:*`,
    ...items.slice(0, MAX_ITEMS).map((u) => {
      const amount = u.amount !== null ? BRL(u.amount) : "valor a definir";
      const when = u.overdue ? `⚠️ vencida ${relativeDate(u.dueDate, today)}` : relativeDate(u.dueDate, today);
      return `• ${u.name} — ${amount} — ${when}`;
    }),
    ...moreLine(items.length),
  ].join("\n");
}

export interface RecentEntry {
  name: string;
  amount: number;
  /** Data do lançamento (YYYY-MM-DD) ou, sem ela, a de criação. */
  date: string;
  category: string | null;
  origin: string | null;
}

export function recentReply(entries: RecentEntry[], today: Date) {
  if (entries.length === 0) return "Nenhum lançamento ainda.";
  return [
    `*Últimos ${entries.length} lançamento${entries.length > 1 ? "s" : ""}:*`,
    ...entries.map(
      (e) => `• ${relativeDate(e.date, today)} ${e.name} — ${BRL(e.amount)} (${categoryLabel(e.category)}${e.origin ? ` · ${e.origin}` : ""})`,
    ),
  ].join("\n");
}

export function confirmExpenseReply(p: { valor: number; descricao: string; categoria: string; data: string }, today: Date) {
  return [
    `Registrar *${BRL(p.valor)}* em *${categoryLabel(p.categoria)}* — "${p.descricao}" — ${relativeDate(p.data, today)}?`,
    "Responda *sim* ou *não*.",
  ].join("\n");
}

export function categoryOptionsReply(options: string[]) {
  return ["Qual categoria?", ...options.map((c, i) => `${i + 1}. ${categoryLabel(c)}`), "Responda com o número."].join("\n");
}

export const registeredReply = (balance: number) => `✅ Registrado. Saldo do mês: ${BRL(balance)}`;

// Aviso proativo do cron (uma mensagem só, agrupando todas as contas).
export function dueAlertMessage(items: UpcomingItem[], today: Date) {
  return [
    "🔔 Vencem em breve:",
    ...items.slice(0, MAX_ITEMS).map((u) => `• ${u.name} — ${u.amount !== null ? BRL(u.amount) : "valor a definir"} — ${relativeDate(u.dueDate, today)}`),
    ...moreLine(items.length),
  ].join("\n");
}

export const HELP_REPLY = [
  "Dá pra perguntar, por exemplo:",
  "• quanto sobrou esse mês?",
  "• quanto gastei com mercado em novembro?",
  "• o que vence essa semana?",
  "• últimos 5 lançamentos",
  "• gastei 45 no posto (peço confirmação antes de salvar)",
  "Atalhos: *saldo*, *ajuda*",
].join("\n");

export const NOT_UNDERSTOOD_REPLY = "Não entendi 🤔 manda *ajuda* pra ver exemplos";
export const UNAVAILABLE_REPLY = "Assistente indisponível no momento. Comandos rápidos: saldo, ajuda.";
export const ERROR_REPLY = "⚠️ Deu erro aqui, tenta de novo.";
export const EXPIRED_REPLY = "Essa confirmação expirou, manda de novo.";
export const NOTHING_PENDING_REPLY = "Não tem nada esperando confirmação. Manda *ajuda* pra ver exemplos.";
export const CANCELLED_REPLY = "Cancelado, nada foi salvo.";
