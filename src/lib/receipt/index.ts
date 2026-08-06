// src/lib/receipt/index.ts
// Leitura de cupom via um único provedor de visão GENÉRICO, configurado por env
// (VISION_FALLBACK_*): qualquer API compatível com OpenAI que tenha um modelo
// de visão (OpenRouter, Mistral, etc.). Veja o .env.example.
import {
  extractReceiptWithCustomVision,
  extractReceiptTextWithCustomVision,
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

// PDF sem camada de texto (provavelmente um scan/imagem dentro do PDF).
export class PdfNoTextError extends Error {
  constructor() {
    super("PDF sem texto reconhecível — envie a nota como imagem (foto ou print).");
    this.name = "PdfNoTextError";
  }
}

// Limite de texto enviado ao LLM: um cupom cabe folgado; evita estourar tokens
// em PDFs longos (ex.: DANFE com muitas páginas).
const MAX_PDF_TEXT_CHARS = 15000;
// Abaixo disso, tratamos como "sem camada de texto" (PDF escaneado).
const MIN_PDF_TEXT_CHARS = 20;

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

// Leitura de nota em PDF: extrai a camada de texto (unpdf, sem dependências
// nativas) e manda ao mesmo provedor de IA em modo texto. PDFs escaneados
// (sem texto) caem em PdfNoTextError — o usuário deve enviar como imagem.
export async function extractReceiptFromPdf(
  pdfBytes: Uint8Array,
): Promise<ReceiptResult> {
  if (!isCustomVisionConfigured()) {
    throw new NoReceiptProviderError();
  }

  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });

  const clean = (text || "").replace(/\s+\n/g, "\n").trim();
  if (clean.length < MIN_PDF_TEXT_CHARS) {
    throw new PdfNoTextError();
  }

  const receipt = await extractReceiptTextWithCustomVision(
    clean.slice(0, MAX_PDF_TEXT_CHARS),
  );
  return { ...receipt, source: "custom" };
}
