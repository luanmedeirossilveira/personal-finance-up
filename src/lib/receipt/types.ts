// src/lib/receipt/types.ts
// Tipos e utilitários compartilhados da leitura de cupom por imagem.

export type SupportedImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

export const SUPPORTED_IMAGE_TYPES: SupportedImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export interface ExtractedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
  amount: number;
}

export interface ExtractedReceipt {
  store: string | null;
  total: number | null;
  date: string | null;
  items: ExtractedReceiptItem[];
}

// Prompt do sistema. A instrução de "somente JSON" guia o provedor de visão
// (o parse tolerante em parseJsonLoose lida com respostas com ruído).
export const RECEIPT_SYSTEM_PROMPT = `Você extrai os produtos de um cupom fiscal ou nota de compra brasileira a partir de uma imagem.
Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois e sem markdown, neste formato exato:
{"store": string|null, "total": number|null, "date": "YYYY-MM-DD"|null, "items": [{"name": string, "quantity": number, "unitPrice": number|null, "amount": number}]}
Regras:
- "amount" é o valor TOTAL do item; "total" é o valor total pago; "date" é a data da compra se visível.
- Use ponto como separador decimal (ex.: 12.90).
- Ignore descontos, subtotais, impostos e formas de pagamento — apenas os produtos.
- Não invente itens: se a imagem não for um cupom legível, retorne items vazio.`;

export const RECEIPT_USER_PROMPT =
  "Extraia os produtos, o valor total e a data desta compra.";

// Interpreta uma resposta possivelmente "suja" (markdown, texto extra) como JSON.
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* tenta estratégias abaixo */
  }
  const withoutFences = trimmed.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(withoutFences);
  } catch {
    /* tenta recortar o objeto */
  }
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(withoutFences.slice(start, end + 1));
  }
  throw new Error("Não foi possível interpretar a resposta como JSON.");
}

// Normaliza o objeto extraído (de qualquer provedor) para o formato canônico.
export function normalizeReceipt(parsed: unknown): ExtractedReceipt {
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(obj.items) ? obj.items : [];

  const items: ExtractedReceiptItem[] = rawItems
    .map((it) => (it && typeof it === "object" ? (it as Record<string, unknown>) : null))
    .filter((it): it is Record<string, unknown> => !!it && typeof it.name === "string" && String(it.name).trim() !== "")
    .map((it) => {
      const quantity = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      const amount = Number(it.amount);
      return {
        name: String(it.name).trim(),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        unitPrice: it.unitPrice != null && Number.isFinite(unitPrice) ? unitPrice : null,
        amount: Number.isFinite(amount) ? amount : 0,
      };
    });

  const total = Number(obj.total);
  return {
    store: obj.store ? String(obj.store).trim() : null,
    total: obj.total != null && Number.isFinite(total) ? total : null,
    date: obj.date ? String(obj.date).trim() : null,
    items,
  };
}
