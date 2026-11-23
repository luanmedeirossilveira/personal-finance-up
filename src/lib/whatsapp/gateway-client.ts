// Cliente do gateway de WhatsApp (Render) para mensagens proativas: GET /health e POST /send.
// Nenhuma falha aqui derruba quem chama: o resultado diz o que houve e o próximo cron tenta de novo.
// O rate limit do gateway é compartilhado com as respostas de conversa (1 msg/s, 30 msgs/h e
// disjuntor anti-loop), por isso quem chama manda no máximo uma mensagem por execução.

const MAX_TEXT = 4096;

export function isGatewayConfigured() {
  return Boolean(process.env.WA_GATEWAY_URL && process.env.WA_SEND_API_TOKEN && process.env.WA_OWNER_NUMBER);
}

const gatewayUrl = (path: string) => `${(process.env.WA_GATEWAY_URL ?? "").replace(/\/+$/, "")}${path}`;

// Também acorda o gateway (cold start do Render), por isso o timeout folgado.
export async function checkHealth(): Promise<{ ok: boolean; waStatus?: string }> {
  try {
    const res = await fetch(gatewayUrl("/health"), { signal: AbortSignal.timeout(30_000), cache: "no-store" });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; waStatus?: string };
    return { ok: Boolean(data.ok), waStatus: data.waStatus };
  } catch {
    return { ok: false };
  }
}

export type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; status: number; error: string; retryAfter?: string | null };

export async function sendToOwner(text: string): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(gatewayUrl("/send"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WA_SEND_API_TOKEN}` },
      body: JSON.stringify({ to: process.env.WA_OWNER_NUMBER, text: text.slice(0, MAX_TEXT) }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[whatsapp] gateway sem resposta no /send:", (e as Error).message);
    return { ok: false, status: 0, error: "network" };
  }

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; messageId?: string; error?: string };
  if (res.ok && data.ok) return { ok: true, messageId: data.messageId ?? null };

  const error = data.error ?? `http_${res.status}`;
  const retryAfter = res.headers.get("retry-after");
  switch (res.status) {
    case 400: // invalid_body: bug do lado de cá
    case 401: // unauthorized: WA_SEND_API_TOKEN diferente do SEND_API_TOKEN do gateway
    case 403: // forbidden_recipient: WA_OWNER_NUMBER fora da allowlist do gateway
      console.error(`[whatsapp] /send recusado (${res.status} ${error}). Confira a configuração.`);
      break;
    case 429: // rate_limited: não insistir nesta execução
      console.warn(`[whatsapp] /send com rate limit; Retry-After=${retryAfter ?? "?"}`);
      break;
    case 503: // whatsapp_disconnected: o próximo cron tenta de novo
      console.warn("[whatsapp] gateway sem sessão do WhatsApp (503)");
      break;
    default:
      console.error(`[whatsapp] /send falhou (${res.status} ${error})`);
  }
  return { ok: false, status: res.status, error, retryAfter };
}
