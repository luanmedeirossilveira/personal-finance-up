// Mensagem → resposta: atalhos sem IA → Gemini (só interpreta) → regex local se o Gemini falhar
// → validação → função de domínio.
import { saoPauloNow } from "./clock";
import { GeminiError, interpret, isGeminiConfigured } from "./gemini";
import { matchShortcut, parseIntent, type Intent } from "./intents";
import { parseLocally } from "./local-parser";
import { UNAVAILABLE_REPLY } from "./templates";
import { runIntent } from "./tools";

export interface HandledMessage {
  intent: string;
  reply: string;
}

export async function resolveIntent(text: string, local: Date): Promise<Intent | null> {
  const shortcut = matchShortcut(text);
  if (shortcut) return shortcut;
  if (isGeminiConfigured()) {
    try {
      const call = await interpret(text, local);
      return parseIntent(call.name, call.args) ?? { name: "naoEntendi", args: {} };
    } catch (e) {
      // Cota estourada, 503 de alta demanda ou timeout (já com retry e modelo reserva).
      console.error("[whatsapp] Gemini indisponível:", e instanceof GeminiError ? e.message : e);
    }
  }
  // Plano B: regex para as frases mais comuns; sem match → resposta de indisponível.
  return parseLocally(text, local);
}

export async function handleMessage(userId: number, text: string, now = new Date()): Promise<HandledMessage> {
  const local = saoPauloNow(now);
  const intent = await resolveIntent(text, local);
  if (!intent) return { intent: "indisponivel", reply: UNAVAILABLE_REPLY };
  return { intent: intent.name, reply: await runIntent(userId, intent, now, local) };
}
