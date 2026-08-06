// src/lib/vision-fallback.ts
// Fallback GENÉRICO de leitura de cupom: aponte para QUALQUER API compatível
// com a OpenAI que tenha um modelo de visão (OpenRouter, Mistral, etc.).
// Configurável 100% por env — sem precisar mexer no código para trocar de
// provedor/modelo. Veja opções gratuitas prontas no .env.example.
import {
  extractReceiptViaOpenAICompatible,
  extractReceiptTextViaOpenAICompatible,
} from "@/lib/receipt/openai-compat";
import type { ExtractedReceipt, SupportedImageMediaType } from "@/lib/receipt/types";

function customVisionEnv() {
  const url = process.env.VISION_FALLBACK_URL;
  const apiKey = process.env.VISION_FALLBACK_KEY;
  const model = process.env.VISION_FALLBACK_MODEL;
  if (!url || !apiKey || !model) {
    throw new Error("VISION_FALLBACK_URL/KEY/MODEL não configurados");
  }
  return {
    url,
    apiKey,
    model,
    providerLabel: process.env.VISION_FALLBACK_LABEL || "IA gratuita",
    // Alguns provedores rejeitam response_format; deixe off por padrão e
    // ligue com VISION_FALLBACK_JSON=true se o seu suportar JSON mode.
    jsonMode: process.env.VISION_FALLBACK_JSON === "true",
  };
}

export function isCustomVisionConfigured(): boolean {
  return !!(
    process.env.VISION_FALLBACK_URL &&
    process.env.VISION_FALLBACK_KEY &&
    process.env.VISION_FALLBACK_MODEL
  );
}

export async function extractReceiptWithCustomVision(
  base64Image: string,
  mediaType: SupportedImageMediaType,
): Promise<ExtractedReceipt> {
  return extractReceiptViaOpenAICompatible({
    ...customVisionEnv(),
    base64Image,
    mediaType,
  });
}

// Leitura a partir do texto de um PDF (mesmo provedor/modelo, entrada em texto).
export async function extractReceiptTextWithCustomVision(
  text: string,
): Promise<ExtractedReceipt> {
  return extractReceiptTextViaOpenAICompatible({
    ...customVisionEnv(),
    text,
  });
}
