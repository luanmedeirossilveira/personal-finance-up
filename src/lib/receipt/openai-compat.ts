// src/lib/receipt/openai-compat.ts
// Cliente genérico para provedores compatíveis com a API da OpenAI
// (OpenRouter, Mistral, etc.) — leitura de cupom por imagem OU por texto (PDF).
import {
  type ExtractedReceipt,
  type SupportedImageMediaType,
  RECEIPT_SYSTEM_PROMPT,
  RECEIPT_USER_PROMPT,
  RECEIPT_TEXT_SYSTEM_PROMPT,
  RECEIPT_TEXT_USER_PROMPT,
  normalizeReceipt,
  parseJsonLoose,
} from "./types";

interface OpenAICompatResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
}

type UserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

// Núcleo compartilhado: monta a requisição chat/completions, faz o fetch e
// normaliza a resposta. As variantes (imagem/texto) só mudam o system prompt
// e o conteúdo da mensagem do usuário.
async function runReceiptCompletion(opts: {
  url: string;
  apiKey: string;
  model: string;
  providerLabel: string;
  jsonMode?: boolean;
  systemPrompt: string;
  userContent: UserContent;
}): Promise<ExtractedReceipt> {
  const { url, apiKey, model, providerLabel, jsonMode, systemPrompt, userContent } = opts;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
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
  const { base64Image, mediaType, ...rest } = opts;
  return runReceiptCompletion({
    ...rest,
    systemPrompt: RECEIPT_SYSTEM_PROMPT,
    userContent: [
      { type: "text", text: RECEIPT_USER_PROMPT },
      { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64Image}` } },
    ],
  });
}

// Leitura a partir do texto extraído de um PDF (NFC-e/DANFE/comprovante digital).
export async function extractReceiptTextViaOpenAICompatible(opts: {
  url: string;
  apiKey: string;
  model: string;
  text: string;
  providerLabel: string;
  jsonMode?: boolean;
}): Promise<ExtractedReceipt> {
  const { text, ...rest } = opts;
  return runReceiptCompletion({
    ...rest,
    systemPrompt: RECEIPT_TEXT_SYSTEM_PROMPT,
    userContent: `${RECEIPT_TEXT_USER_PROMPT}\n\n---\n${text}`,
  });
}
