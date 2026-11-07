// Camada 2 dos insights: Gemini como redator. Recebe só o JSON de fatos agregados
// (sem descrição de transação, sem nome de banco) e devolve os 3 mais relevantes.
// Usa o endpoint compatível com OpenAI, no mesmo padrão de lib/receipt/openai-compat.ts.
import type { Fact } from "./facts";

const DEFAULT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export interface WrittenInsight {
  type: string;
  title: string;
  message: string;
  action: string;
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);
}

const SYSTEM_PROMPT = `Você escreve insights financeiros pessoais em português do Brasil, para uma pessoa só.
Regras:
- Use SOMENTE os números presentes nos fatos. Nunca invente valores, datas ou percentuais.
- Escolha os 3 fatos mais relevantes (urgência e possibilidade de ação), em ordem.
- Cada insight: "title" curto (até 6 palavras), "message" com número + causa em uma frase, "action" com uma ação concreta em uma frase.
- Tom direto, sem alarmismo, sem emojis.
- Valores em reais no formato "R$ 1.234,56".
Responda apenas JSON: {"insights":[{"type":"<type do fato>","title":"...","message":"...","action":"..."}]}`;

function parseLoose(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("JSON não encontrado");
  return JSON.parse(content.slice(start, end + 1)) as { insights?: WrittenInsight[] };
}

// Barreira contra número inventado: todo "R$ X" do texto precisa existir (±1) nos fatos daquele tipo.
export function numbersAreGrounded(text: string, fact: Fact) {
  const known = Object.values(fact.data).filter((v): v is number => typeof v === "number");
  const values = Array.from(text.matchAll(/R\$\s?([\d.]+(?:,\d{1,2})?)/g)).map((m) =>
    Number.parseFloat(m[1].replace(/\./g, "").replace(",", ".")),
  );
  return values.every((v) => known.some((k) => Math.abs(Math.abs(k) - v) <= 1));
}

export async function writeInsightsWithGemini(facts: Fact[]): Promise<WrittenInsight[]> {
  if (!isGeminiConfigured()) throw new Error("Gemini não configurado");
  const payload = facts.slice(0, 8).map((f) => ({ type: f.type, tone: f.tone, weight: f.weight, ...f.data }));

  const res = await fetch(process.env.GEMINI_API_URL || DEFAULT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GEMINI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.GEMINI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Fatos da semana:\n${JSON.stringify(payload)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia do Gemini");

  const byType = new Map(facts.map((f) => [f.type as string, f]));
  const written = (parseLoose(content).insights ?? []).filter((i) => {
    const fact = i && byType.get(i.type);
    return fact && i.title && i.message && numbersAreGrounded(`${i.message} ${i.action ?? ""}`, fact);
  });
  if (written.length === 0) throw new Error("Gemini não devolveu insights válidos");
  return written.slice(0, 3);
}
