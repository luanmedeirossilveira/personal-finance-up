// Autenticação do webhook do gateway: HMAC-SHA256 de `${timestamp}.${rawBody}` com o segredo
// compartilhado. O gateway assina os bytes exatos que envia, por isso a verificação usa o corpo
// cru (re-serializar o JSON quebraria a assinatura). Timestamp em segundos, janela de 5 min contra replay.
import { createHmac, timingSafeEqual } from "crypto";

export const MAX_SKEW_SECONDS = 300;

export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "expired" | "invalid" };

export function signPayload(secret: string, timestamp: string, rawBody: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

export function verifySignature({
  rawBody,
  timestamp,
  signature,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string | undefined;
  nowSeconds?: number;
}): VerifyResult {
  if (!secret || !timestamp || !signature) return { ok: false, reason: "missing" };
  const ts = Number(timestamp);
  if (!/^\d+$/.test(timestamp) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: "expired" };

  const expected = Buffer.from(signPayload(secret, timestamp, rawBody));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return { ok: false, reason: "invalid" };
  return { ok: true };
}

export interface InboundMessage {
  messageId: string;
  from: string;
  text: string;
  timestamp: number;
}

// Contrato do corpo enviado pelo gateway (o texto já chega aparado).
export function parseInbound(body: unknown): InboundMessage | null {
  if (!body || typeof body !== "object") return null;
  const { messageId, from, text, timestamp } = body as Record<string, unknown>;
  if (typeof messageId !== "string" || !messageId) return null;
  if (typeof from !== "string" || !from) return null;
  if (typeof text !== "string") return null;
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  return { messageId, from, text, timestamp };
}

// Só dígitos: o gateway aceita o número com ou sem "+".
export const sameNumber = (a: string, b: string | undefined) =>
  !!b && a.replace(/\D/g, "") !== "" && a.replace(/\D/g, "") === b.replace(/\D/g, "");
