// Resolve a categoria em texto livre (do Gemini ou da descrição do gasto) contra as categorias
// reais de lib/categories.ts. Sem acento/caixa, com apelidos do dia a dia e match aproximado
// para erro de digitação. Mais de um candidato igualmente próximo → ambíguo (o assistente pergunta).
import { SPENDING_CATEGORIES, normalizeCategory, type SpendingCategory } from "@/lib/categories";

export type CategoryMatch =
  | { kind: "match"; category: SpendingCategory }
  | { kind: "ambiguous"; options: SpendingCategory[] }
  | { kind: "none" };

export const fold = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Palavras comuns em mensagens → categoria. Complementa os apelidos de lib/categories.ts.
const KEYWORDS: Record<string, SpendingCategory> = {
  posto: "transporte",
  gasolina: "transporte",
  combustivel: "transporte",
  etanol: "transporte",
  uber: "transporte",
  "99": "transporte",
  onibus: "transporte",
  metro: "transporte",
  estacionamento: "transporte",
  pedagio: "transporte",
  mecanico: "carro",
  oficina: "carro",
  ipva: "carro",
  licenciamento: "carro",
  detran: "carro",
  supermercado: "alimentação",
  mercado: "alimentação",
  feira: "alimentação",
  acougue: "alimentação",
  restaurante: "alimentação",
  ifood: "alimentação",
  almoco: "alimentação",
  janta: "alimentação",
  jantar: "alimentação",
  cafe: "alimentação",
  pizza: "alimentação",
  comida: "alimentação",
  farmacia: "saude",
  remedio: "saude",
  medico: "saude",
  consulta: "saude",
  dentista: "saude",
  exame: "saude",
  aluguel: "moradia",
  condominio: "moradia",
  luz: "moradia",
  energia: "moradia",
  agua: "moradia",
  internet: "moradia",
  gas: "moradia",
  netflix: "assinaturas",
  spotify: "assinaturas",
  streaming: "assinaturas",
  roupa: "vestuário",
  roupas: "vestuário",
  sapato: "vestuário",
  tenis: "vestuário",
  cinema: "lazer",
  bar: "lazer",
  show: "lazer",
  passeio: "lazer",
  passagem: "viagem",
  hotel: "viagem",
  airbnb: "viagem",
  voo: "viagem",
  salao: "beleza",
  cabelo: "beleza",
  manicure: "beleza",
  amazon: "compras",
  shopee: "compras",
  presente: "compras",
  emprestimo: "dívidas",
  parcela: "dívidas",
};

const FOLDED = SPENDING_CATEGORIES.map((c) => ({ category: c, key: fold(c) }));

export function levenshtein(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function exactOrAlias(word: string, allowed: readonly SpendingCategory[]): SpendingCategory | null {
  const key = fold(word);
  if (!key) return null;
  const exact = FOLDED.find((c) => c.key === key)?.category;
  const viaApp = normalizeCategory(word.trim().toLowerCase());
  const candidate = exact ?? (viaApp !== "outros" ? viaApp : null) ?? KEYWORDS[key] ?? null;
  return candidate && allowed.includes(candidate) ? candidate : null;
}

// Categoria dita pela pessoa ("mercado", "saude", "trasnporte").
export function resolveCategory(raw: string | null | undefined, allowed: readonly SpendingCategory[] = SPENDING_CATEGORIES): CategoryMatch {
  const text = fold(raw ?? "");
  if (!text) return { kind: "none" };

  const direct = exactOrAlias(text, allowed);
  if (direct) return { kind: "match", category: direct };

  // Frase ("gasto com mercado"): primeira palavra que bate exata ou por apelido.
  const fromWords = guessCategoryFromText(text, allowed);
  if (fromWords) return { kind: "match", category: fromWords };

  // Categoria conhecida, mas fora da lista permitida ("cartão" num gasto novo): não aproxima para
  // outra parecida ("cartão" → "carro").
  if (FOLDED.some((c) => c.key === text) || normalizeCategory(text) !== "outros") return { kind: "none" };

  // Aproximado: prefixo (≥ 3 letras) ou até 2 letras de diferença; empate → ambíguo.
  const pool = FOLDED.filter((c) => allowed.includes(c.category));
  const prefixed = text.length >= 3 ? pool.filter((c) => c.key.startsWith(text)) : [];
  if (prefixed.length === 1) return { kind: "match", category: prefixed[0].category };
  if (prefixed.length > 1) return { kind: "ambiguous", options: prefixed.map((c) => c.category) };

  if (text.length < 4) return { kind: "none" };
  const scored = pool.map((c) => ({ category: c.category, d: levenshtein(text, c.key) })).filter((c) => c.d <= 2);
  if (scored.length === 0) return { kind: "none" };
  const best = Math.min(...scored.map((c) => c.d));
  const top = scored.filter((c) => c.d === best).map((c) => c.category);
  return top.length === 1 ? { kind: "match", category: top[0] } : { kind: "ambiguous", options: top };
}

// Categoria a partir da descrição do gasto ("posto shell" → transporte). Só exato/apelido, sem
// aproximação, para não chutar categoria errada.
export function guessCategoryFromText(text: string, allowed: readonly SpendingCategory[] = SPENDING_CATEGORIES) {
  for (const word of fold(text).split(/[^a-z0-9]+/)) {
    const hit = exactOrAlias(word, allowed);
    if (hit) return hit;
  }
  return null;
}
