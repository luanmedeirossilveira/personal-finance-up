// src/lib/items.ts
// Normalização dos itens (produtos) de uma compra de cartão.
// Compartilhado entre cartão alimentação e cartão de crédito — o modelo de produto
// (nome, quantidade, preço unitário, valor, categoria) é idêntico nos dois.

interface RawItem {
  name?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  amount?: unknown;
  category?: unknown;
}

export interface NormalizedItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  amount: number;
  category: string | null;
}

export function normalizeItems(raw: unknown): NormalizedItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawItem[])
    .filter((it) => it && typeof it.name === "string" && it.name.trim() !== "")
    .map((it) => {
      const quantity = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      const amount = Number(it.amount);
      return {
        name: String(it.name).trim(),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unitPrice:
          it.unitPrice != null && it.unitPrice !== "" && Number.isFinite(unitPrice)
            ? unitPrice
            : null,
        amount: Number.isFinite(amount) ? amount : 0,
        category: it.category ? String(it.category) : null,
      };
    });
}
