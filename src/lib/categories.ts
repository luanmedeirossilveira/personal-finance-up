// Categorias de gasto — uma lista só para contas, compras no cartão de crédito, limites e importação.
// Sem dependências de servidor (usada no cliente).

export const SPENDING_CATEGORIES = [
  "moradia",
  "alimentação",
  "transporte",
  "saude",
  "compras",
  "lazer",
  "assinaturas",
  "vestuário",
  "beleza",
  "investimentos",
  "dívidas",
  "cartão",
  "outros",
] as const;
export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

export const CATEGORY_CONFIG: Record<SpendingCategory, { label: string; emoji: string }> = {
  moradia: { label: "Moradia", emoji: "🏠" },
  alimentação: { label: "Alimentação", emoji: "🍽️" },
  transporte: { label: "Transporte", emoji: "🚗" },
  saude: { label: "Saúde", emoji: "❤️" },
  compras: { label: "Compras", emoji: "🛍️" },
  lazer: { label: "Lazer", emoji: "🎉" },
  assinaturas: { label: "Assinaturas", emoji: "📺" },
  vestuário: { label: "Vestuário", emoji: "👗" },
  beleza: { label: "Beleza", emoji: "💄" },
  investimentos: { label: "Investimentos", emoji: "📈" },
  dívidas: { label: "Dívidas", emoji: "💸" },
  cartão: { label: "Cartão (sem detalhe)", emoji: "💳" },
  outros: { label: "Outros", emoji: "📦" },
};

// Compra no cartão de crédito: todas as gerais, menos "cartão" (a própria fatura).
export const CARD_TX_CATEGORIES = SPENDING_CATEGORIES.filter((c) => c !== "cartão");
// Conta normal: todas, menos "cartão" (definida automaticamente para faturas).
export const BILL_FORM_CATEGORIES = SPENDING_CATEGORIES.filter((c) => c !== "cartão");

// Grafias antigas e subcategorias do cartão alimentação → categoria geral.
const ALIASES: Record<string, SpendingCategory> = {
  saúde: "saude",
  alimentacao: "alimentação",
  vestuario: "vestuário",
  dividas: "dívidas",
  cartao: "cartão",
  refeição: "alimentação",
  refeicao: "alimentação",
  mercado: "alimentação",
  lanche: "alimentação",
  delivery: "alimentação",
  padaria: "alimentação",
};

export function normalizeCategory(raw: string | null | undefined): SpendingCategory {
  const key = (raw || "").trim().toLowerCase();
  if ((SPENDING_CATEGORIES as readonly string[]).includes(key)) return key as SpendingCategory;
  return ALIASES[key] ?? "outros";
}

export const categoryLabel = (c: string | null | undefined) => CATEGORY_CONFIG[normalizeCategory(c)].label;
