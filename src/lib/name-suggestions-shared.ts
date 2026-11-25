// Sugestão de descrição para compras repetitivas (conta, cartão de crédito e cartão alimentação).
// Regras puras (sem DB): agrupar o histórico por nome e filtrar pelo que a pessoa está digitando.
// Usadas na rota /api/name-suggestions e no autocomplete do cliente.

export type SuggestionSource = "bill" | "card" | "meal";
export const SUGGESTION_SOURCES: readonly SuggestionSource[] = ["bill", "card", "meal"];

export interface NameHistoryRow {
  name: string;
  category: string | null;
  amount: number;
  /** Data da compra ou, sem ela, a de criação. Serve só para ordenar por recência. */
  usedAt: string | null;
}

export interface NameSuggestion {
  /** Grafia mais recente. */
  name: string;
  /** Categoria mais recente preenchida. */
  category: string | null;
  lastAmount: number;
  /** Valor das últimas compras quando elas se repetem iguais (assinatura, mensalidade); senão null. */
  fixedAmount: number | null;
  count: number;
  lastUsed: string;
}

// Quantas compras recentes precisam ter o mesmo valor para ele ser sugerido junto.
const FIXED_AMOUNT_WINDOW = 3;

// "Padaria do Zé" e "PADARIA DO ZE" são a mesma compra: sem caixa, acento e espaço duplo.
export const foldName = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

const byFrequency = (a: NameSuggestion, b: NameSuggestion) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed);

export function buildNameSuggestions(rows: NameHistoryRow[]): NameSuggestion[] {
  const recentFirst = [...rows].sort((a, b) => (b.usedAt ?? "").localeCompare(a.usedAt ?? ""));
  const groups = new Map<string, NameHistoryRow[]>();
  for (const r of recentFirst) {
    const key = foldName(r.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return Array.from(groups.values())
    .map((g) => {
      const recent = g.slice(0, FIXED_AMOUNT_WINDOW).map((r) => r.amount);
      const fixed = recent.length >= 2 && recent.every((a) => Math.abs(a - recent[0]) < 0.005);
      return {
        name: g[0].name.trim(),
        category: g.find((r) => r.category)?.category ?? null,
        lastAmount: g[0].amount,
        fixedAmount: fixed ? recent[0] : null,
        count: g.length,
        lastUsed: g[0].usedAt ?? "",
      };
    })
    .sort(byFrequency);
}

// Começo do nome > começo de uma palavra > contém. Empate: mais usada, depois mais recente.
// Sem texto digitado, devolve as mais usadas (atalho para o que se repete toda semana).
export function matchNameSuggestions(list: NameSuggestion[], query: string, limit = 6): NameSuggestion[] {
  const q = foldName(query);
  if (!q) return [...list].sort(byFrequency).slice(0, limit);

  const scored: { s: NameSuggestion; score: number }[] = [];
  for (const s of list) {
    const key = foldName(s.name);
    const score = key.startsWith(q) ? 0 : key.split(/[^a-z0-9]+/).some((w) => w.startsWith(q)) ? 1 : key.includes(q) ? 2 : -1;
    if (score >= 0) scored.push({ s, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || byFrequency(a.s, b.s))
    .slice(0, limit)
    .map((x) => x.s);
}
