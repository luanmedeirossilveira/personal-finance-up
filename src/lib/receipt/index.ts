// src/lib/receipt/index.ts
// Leitura de cupom via um único provedor de visão GENÉRICO, configurado por env
// (VISION_FALLBACK_*): qualquer API compatível com OpenAI que tenha um modelo
// de visão (OpenRouter, Mistral, etc.). Veja o .env.example.
import {
  extractReceiptWithCustomVision,
  isCustomVisionConfigured,
} from "@/lib/vision-fallback";
import type { SupportedImageMediaType } from "./types";

export * from "./types";

export class NoReceiptProviderError extends Error {
  constructor() {
    super("Leitura por imagem não configurada (defina VISION_FALLBACK_URL/KEY/MODEL)");
    this.name = "NoReceiptProviderError";
  }
}

export type ReceiptSource = "custom";
export interface ReceiptResult {
  store: string | null;
  total: number | null;
  date: string | null;
  items: import("./types").ExtractedReceiptItem[];
  source: ReceiptSource;
}

export async function extractReceipt(
  base64Image: string,
  mediaType: SupportedImageMediaType,
): Promise<ReceiptResult> {
  if (!isCustomVisionConfigured()) {
    throw new NoReceiptProviderError();
  }
  const receipt = await extractReceiptWithCustomVision(base64Image, mediaType);
  return { ...receipt, source: "custom" };
}
