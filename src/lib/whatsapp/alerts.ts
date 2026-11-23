// Aviso proativo diário: contas pendentes que vencem hoje ou amanhã, numa mensagem só (o rate
// limit do gateway é compartilhado com a conversa). Não repete no mesmo dia e nunca lança erro.
import { todayISO } from "@/lib/month";
import { saoPauloNow } from "./clock";
import { checkHealth, isGatewayConfigured, sendToOwner } from "./gateway-client";
import { saveMessage, sentSince } from "./store";
import { dueAlertMessage } from "./templates";
import { upcomingFor } from "./tools";

const ALERT_INTENT = "alerta_vencimento";

export type DueAlertResult =
  | { sent: true; count: number }
  | { sent: false; reason: "not_configured" | "already_sent" | "nothing_due" | "gateway_offline" | "send_failed" | "error"; count?: number };

export async function sendDueAlerts(userId: number, now = new Date()): Promise<DueAlertResult> {
  if (!isGatewayConfigured()) return { sent: false, reason: "not_configured" };
  try {
    const local = saoPauloNow(now);
    // Meia-noite de São Paulo em UTC (sem horário de verão desde 2019: UTC−3), no formato do datetime('now').
    if (await sentSince(userId, ALERT_INTENT, `${todayISO(local)} 03:00:00`)) return { sent: false, reason: "already_sent" };

    const items = (await upcomingFor(userId, local, 1, false)).filter((u) => !u.overdue);
    if (items.length === 0) return { sent: false, reason: "nothing_due" };

    const health = await checkHealth();
    if (!health.ok || health.waStatus !== "open") {
      console.warn(`[whatsapp] gateway indisponível para o aviso (waStatus=${health.waStatus ?? "?"})`);
      return { sent: false, reason: "gateway_offline", count: items.length };
    }

    const text = dueAlertMessage(items, local);
    const result = await sendToOwner(text);
    if (!result.ok) return { sent: false, reason: "send_failed", count: items.length };

    await saveMessage({ userId, messageId: null, direction: "out", text, intent: ALERT_INTENT, reply: null });
    return { sent: true, count: items.length };
  } catch (e) {
    console.error("[whatsapp] aviso de vencimento falhou:", e);
    return { sent: false, reason: "error" };
  }
}
