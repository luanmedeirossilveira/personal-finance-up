// Plano B quando o Gemini está fora (503, cota, timeout ou sem chave): regex para as frases mais
// comuns. Só entra depois que o Gemini falhou, porque ele entende variações que isto não pega.
// Pura; o resultado passa pela mesma validação (parseIntent) que a saída do Gemini.
import { fold } from "./categories";
import { parseIntent, type Intent } from "./intents";

const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3, abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9, outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

// "em novembro", "de outubro", "mes passado" → "YYYY-MM". Sem mês citado → undefined (período de trabalho).
function monthFrom(t: string, local: Date) {
  if (/\bmes passado\b/.test(t)) {
    const d = new Date(local.getFullYear(), local.getMonth() - 1, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  const m = /\b(?:em|de|do|no)\s+([a-z]+)\b/g;
  for (const match of Array.from(t.matchAll(m))) {
    const month = MONTHS[match[1]];
    if (month) return `${local.getFullYear()}-${pad(month)}`;
  }
  return undefined;
}

const AMOUNT = String.raw`(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(k|mil)?\s*(?:reais|real|conto|contos|pila|pilas)?`;
const EXPENSE_RE = new RegExp(String.raw`^(?:gastei|paguei|comprei|torrei)\s+${AMOUNT}\s+(?:(?:no|na|nos|nas|em|de|do|da|com|pro|pra)\s+)?(.+)$`);
const EXPENSE_FIRST_RE = new RegExp(String.raw`^(?:gastei|paguei|comprei)\s+(?:(?:no|na|em|com)\s+)?(.+?)\s+${AMOUNT}$`);

export function parseLocally(text: string, local: Date): Intent | null {
  const base = text.trim().replace(/[?!.]+$/, "");
  const t = fold(base);
  // fold() mantém o tamanho do texto: o fim da frase original preserva acento e caixa da descrição.
  const tail = (folded: string) => {
    const original = base.slice(base.length - folded.length);
    return fold(original) === folded ? original : folded;
  };

  // "gastei 45 no posto", "paguei R$ 32,90 na farmácia", "gastei 1k de mercado"
  const exp = EXPENSE_RE.exec(t);
  if (exp) {
    const valor = Number.parseFloat(exp[1].replace(",", ".")) * (exp[2] ? 1000 : 1);
    return parseIntent("registrarGasto", { valor, descricao: tail(exp[3]) });
  }
  // "gastei no mercado 45"
  const expFirst = EXPENSE_FIRST_RE.exec(t);
  if (expFirst) {
    const valor = Number.parseFloat(expFirst[2].replace(",", ".")) * (expFirst[3] ? 1000 : 1);
    return parseIntent("registrarGasto", { valor, descricao: expFirst[1] });
  }

  // "o que vence essa semana?", "tem conta vencendo hoje", "contas a pagar"
  if (/\bvenc|\ba pagar\b|\bpra pagar\b/.test(t)) {
    const dias = /\b(hoje|hj|amanha)\b/.test(t) ? 1 : /\bmes\b/.test(t) ? 30 : 7;
    return parseIntent("contasAVencer", { dias });
  }

  // "últimos 5 lançamentos", "ultimos gastos"
  const recent = /\bultim[oa]s?\s*(\d{1,2})?\s*(?:lancamentos?|gastos?|compras?|contas?)?\b/.exec(t);
  if (recent && /lanca|gasto|compra|conta|^ultim/.test(t)) {
    return parseIntent("ultimosLancamentos", { quantidade: recent[1] ? Number(recent[1]) : undefined });
  }

  // "quanto gastei com mercado em novembro", "gastos de lazer"
  // "gastei no mercado" sem valor e sem "quanto" não é consulta (é gasto incompleto).
  const cat =
    /\b(?:quanto|qto|qnt|total)\b.*\bgast(?:ei|ou|amos|o|os)\s+(?:com|de|em|no|na)\s+([a-z0-9]+)/.exec(t) ??
    /\bgastos?\s+(?:com|de|em|no|na)\s+([a-z0-9]+)/.exec(t);
  if (cat && !MONTHS[cat[1]]) return parseIntent("gastosPorCategoria", { categoria: cat[1], mes: monthFrom(t, local) });
  if (/\b(onde|com o que)\b.*\bgast/.test(t) || /\bmaiores gastos\b/.test(t)) {
    return parseIntent("gastosPorCategoria", { mes: monthFrom(t, local) });
  }

  // "quanto sobrou esse mês?", "saldo de outubro", "resumo do mês"
  if (/\b(sobrou|sobra|saldo|resumo|balanco)\b/.test(t)) return parseIntent("resumoMes", { mes: monthFrom(t, local) });

  return null;
}
