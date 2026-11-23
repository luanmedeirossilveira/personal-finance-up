// Aviso de contas vencendo pelo WhatsApp. Não tem cron próprio em vercel.json (o Hobby limita
// o número de crons): roda dentro de /api/cron/notifications. Esta rota serve para disparar à mão.
import { NextRequest, NextResponse } from "next/server";
import { getOwnerUser } from "@/lib/whatsapp/store";
import { sendDueAlerts } from "@/lib/whatsapp/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const owner = await getOwnerUser();
  if (!owner) return NextResponse.json({ ok: true, whatsapp: null });
  return NextResponse.json({ ok: true, whatsapp: await sendDueAlerts(owner.id) });
}
