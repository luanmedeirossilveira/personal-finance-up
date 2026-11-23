// Webhook do gateway de WhatsApp. Público no middleware: autentica por HMAC do corpo cru.
// Contrato: 200 { reply } em até ~20s (o gateway desiste em 25s). Erro interno também é 200,
// com uma resposta amigável, para o usuário não ficar sem retorno.
import { NextRequest, NextResponse } from "next/server";
import { handleMessage } from "@/lib/whatsapp/router";
import { findSavedReply, getOwnerUser, saveMessage } from "@/lib/whatsapp/store";
import { ERROR_REPLY } from "@/lib/whatsapp/templates";
import { parseInbound, sameNumber, verifySignature } from "@/lib/whatsapp/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REPLY_BUDGET_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`sem resposta em ${ms}ms`)), ms)),
  ]);
}

export async function POST(req: NextRequest) {
  // Corpo cru ANTES de qualquer parse: a assinatura é sobre os bytes enviados.
  const rawBody = await req.text();
  const check = verifySignature({
    rawBody,
    timestamp: req.headers.get("x-gateway-timestamp"),
    signature: req.headers.get("x-gateway-signature"),
    secret: process.env.WA_SHARED_SECRET,
  });
  if (!check.ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const message = parseInbound(body);
  if (!message) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  if (!sameNumber(message.from, process.env.WA_OWNER_NUMBER)) {
    return NextResponse.json({ error: "Número não autorizado" }, { status: 403 });
  }

  try {
    const reply = await withTimeout(
      (async () => {
        const owner = await getOwnerUser();
        if (!owner) throw new Error("nenhum usuário cadastrado");
        // Idempotência (segunda camada; o gateway já descarta messageId repetido).
        const saved = await findSavedReply(message.messageId);
        if (saved) return saved.reply;

        const handled = await handleMessage(owner.id, message.text);
        await saveMessage({
          userId: owner.id,
          messageId: message.messageId,
          direction: "in",
          text: message.text,
          intent: handled.intent,
          reply: handled.reply,
        });
        return handled.reply;
      })(),
      REPLY_BUDGET_MS,
    );
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[whatsapp] erro ao processar mensagem:", (e as Error).message);
    return NextResponse.json({ reply: ERROR_REPLY });
  }
}
