// src/lib/receipt/openai-compat.ts
// Cliente genérico para provedores compatíveis com a API da OpenAI
// (OpenRouter, Mistral, etc.) — leitura de cupom por imagem.
import {
  type ExtractedReceipt,
  type SupportedImageMediaType,
  RECEIPT_SYSTEM_PROMPT,
  RECEIPT_USER_PROMPT,
  normalizeReceipt,
  parseJsonLoose,
} from "./types";

interface OpenAICompatResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
}

export async function extractReceiptViaOpenAICompatible(opts: {
  url: string;
  apiKey: string;
  model: string;
  base64Image: string;
  mediaType: SupportedImageMediaType;
  providerLabel: string;
  /** Adiciona response_format json_object (quando o provedor suporta). */
  jsonMode?: boolean;
}): Promise<ExtractedReceipt> {
  const { url, apiKey, model, base64Image, mediaType, providerLabel, jsonMode } = opts;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: RECEIPT_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: RECEIPT_USER_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${base64Image}` },
          },
        ],
      },
    ],
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${providerLabel} ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as OpenAICompatResponse;
  let content = data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    content = content.map((c) => c?.text ?? "").join("");
  }
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error(`Resposta inesperada de ${providerLabel}.`);
  }

  return normalizeReceipt(parseJsonLoose(content));
}
