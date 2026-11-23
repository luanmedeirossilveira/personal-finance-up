// Gemini como intérprete: texto da mensagem → { função, argumentos } via function calling.
// Recebe SÓ a mensagem e a data/hora de hoje. Nenhum saldo, valor do banco ou lançamento vai para
// o modelo (no tier gratuito o Google pode usar o conteúdo enviado). Ele também nunca escreve no
// banco nem gera SQL: só escolhe uma das funções abaixo.
// Endpoint compatível com OpenAI, no mesmo padrão de lib/insights/gemini.ts (sem SDK extra).
import { BILL_FORM_CATEGORIES } from "@/lib/categories";
import { MONTHS, todayISO } from "@/lib/month";

const DEFAULT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
// O webhook precisa responder em ~20s (o gateway desiste em 25s): todas as tentativas cabem nisto.
const BUDGET_MS = 14_000;
const ATTEMPT_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 700;
// 503 "high demand" e 5xx costumam passar em segundos; 429 é cota do modelo (repetir não adianta).
const TRANSIENT = new Set([500, 502, 503, 504]);

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && geminiModels().length > 0);
}

const MES = { type: "string", description: "Mês no formato YYYY-MM. Omita quando a pessoa não citar um mês." };

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

export const TOOLS = [
  fn("resumoMes", "Entradas, saídas e saldo previsto do mês (\"quanto sobrou\", \"saldo\").", { mes: MES }),
  fn("gastosPorCategoria", "Quanto foi gasto numa categoria, ou as maiores categorias do mês.", {
    categoria: { type: "string", description: "Categoria com as palavras da pessoa (ex.: \"mercado\"). Omita para ver as maiores." },
    mes: MES,
  }),
  fn("contasAVencer", "Contas pendentes que vencem nos próximos dias.", {
    dias: { type: "integer", description: "Quantos dias à frente (1 a 60). \"essa semana\" = 7, \"hoje\" = 1." },
  }),
  fn("ultimosLancamentos", "Os lançamentos mais recentes.", {
    quantidade: { type: "integer", description: "Quantos (1 a 20). Padrão 5." },
  }),
  fn(
    "registrarGasto",
    "A pessoa conta que gastou/pagou/comprou algo. Não salva: o app pede confirmação.",
    {
      valor: { type: "number", description: "Valor em reais, ex.: 45.9" },
      descricao: { type: "string", description: "Onde ou o quê, curto (ex.: \"posto\")." },
      categoria: { type: "string", description: `Só se for óbvia, uma de: ${BILL_FORM_CATEGORIES.join(", ")}.` },
      data: { type: "string", description: "Data do gasto YYYY-MM-DD. Omita se for hoje." },
    },
    ["valor", "descricao"],
  ),
  fn("confirmarAcao", "Resposta a um pedido de confirmação (sim/não, confirma, cancela).", {
    confirmar: { type: "boolean" },
  }, ["confirmar"]),
  fn("ajuda", "Saudação, pedido de ajuda ou \"o que você faz?\"."),
  fn("naoEntendi", "Qualquer coisa fora das outras funções."),
];

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function systemPrompt(now: Date) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `Você interpreta mensagens de WhatsApp de um app de finanças pessoais e SEMPRE chama exatamente uma função.
Agora: ${WEEKDAYS[now.getDay()]}, ${todayISO(now)} ${hh}:${mm} (America/Sao_Paulo). Mês atual: ${MONTHS[now.getMonth()]}.
Regras:
- "esse mês", "este mês" ou nenhum mês citado → omita "mes". Mês citado sem ano → ano atual.
- Datas relativas ("ontem", "sexta") → YYYY-MM-DD.
- "gastei/paguei/comprei X em Y" → registrarGasto. Valor em reais ("45 conto" = 45, "1k" = 1000).
- Gírias e erros de digitação são normais; interprete a intenção.
- Nunca invente valores: use só números escritos na mensagem.`;
}

export interface ToolCall {
  name: string;
  args: unknown;
}

export class GeminiError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GEMINI_MODEL aceita uma lista separada por vírgula, em ordem de preferência. No tier gratuito
// cada modelo tem cota e carga próprias: se um está em alta demanda (503) ou sem cota (429), o
// próximo costuma responder. Com um modelo só, ele ganha uma segunda tentativa após uma pausa.
export function geminiModels() {
  const list = (process.env.GEMINI_MODEL ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return Array.from(new Set(list));
}

function attemptPlan() {
  const models = geminiModels();
  if (models.length === 1) return [{ model: models[0], retry: false }, { model: models[0], retry: true }];
  return models.map((model) => ({ model, retry: false }));
}

async function callModel(model: string, text: string, now: Date, timeoutMs: number) {
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt(now) },
      { role: "user", content: text.slice(0, 500) },
    ],
    tools: TOOLS,
    tool_choice: "required", // modo ANY: sempre escolhe uma função
    temperature: 0,
  };
  // Para conferir que nenhum dado financeiro sai do app (WA_DEBUG=1 nos logs da Vercel).
  if (process.env.WA_DEBUG === "1") console.debug("[whatsapp] payload Gemini", JSON.stringify(body));

  try {
    return await fetch(process.env.GEMINI_API_URL || DEFAULT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GEMINI_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return new GeminiError(`Gemini sem resposta (${model}): ${(e as Error).message}`);
  }
}

export async function interpret(text: string, now: Date): Promise<ToolCall> {
  if (!isGeminiConfigured()) throw new GeminiError("Gemini não configurado");
  const deadline = Date.now() + BUDGET_MS;
  let lastError = new GeminiError("Gemini sem tentativas");
  let lastStatus = 0;

  for (const attempt of attemptPlan()) {
    // A segunda chamada ao mesmo modelo só vale para erro transitório (timeout ou 5xx).
    if (attempt.retry) {
      if (lastStatus !== 0 && !TRANSIENT.has(lastStatus)) continue;
      await sleep(RETRY_DELAY_MS);
    }
    const remaining = deadline - Date.now();
    if (remaining < 1_000) break;

    const res = await callModel(attempt.model, text, now, Math.min(ATTEMPT_TIMEOUT_MS, remaining));
    if (res instanceof GeminiError) {
      lastError = res;
      lastStatus = 0;
      continue;
    }
    if (!res.ok) {
      lastStatus = res.status;
      lastError = new GeminiError(`Gemini ${res.status} (${attempt.model}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
      continue;
    }
    return parseToolCall(await res.json());
  }
  throw lastError;
}

function parseToolCall(data: {
  choices?: { message?: { tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
}): ToolCall {
  const call = data.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call?.name) return { name: "naoEntendi", args: {} };
  let args: unknown = {};
  try {
    args = call.arguments ? JSON.parse(call.arguments) : {};
  } catch {
    // argumentos malformados: a validação trata como ausentes
  }
  return { name: call.name, args };
}
