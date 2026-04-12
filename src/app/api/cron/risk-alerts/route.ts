// src/app/api/cron/risk-alerts/route.ts
// Roda toda segunda-feira às 8h (ver vercel.json)
// Detecta riscos do mês atual vs anterior e envia email para Luan + Franciele

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { detectRisks } from "@/lib/risk";
import { sendRiskAlertsEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const adminUser = await db.query.users.findFirst();
  if (!adminUser) return NextResponse.json({ ok: true });

  // Busca contas dos dois meses
  const [currentBills, previousBills] = await Promise.all([
    db.query.bills.findMany({
      where: and(
        eq(schema.bills.userId, adminUser.id),
        eq(schema.bills.month, month),
        eq(schema.bills.year, year),
      ),
    }),
    db.query.bills.findMany({
      where: and(
        eq(schema.bills.userId, adminUser.id),
        eq(schema.bills.month, prevMonth),
        eq(schema.bills.year, prevYear),
      ),
    }),
  ]);

  const detected = detectRisks(currentBills, previousBills);

  if (detected.length === 0) {
    return NextResponse.json({ ok: true, alerts: 0 });
  }

  // Persiste alertas (upsert por tipo/mês/ano — evita duplicatas se o cron rodar duas vezes)
  for (const alert of detected) {
    const existing = await db.query.riskAlerts.findFirst({
      where: and(
        eq(schema.riskAlerts.userId, adminUser.id),
        eq(schema.riskAlerts.type, alert.type),
        eq(schema.riskAlerts.month, month),
        eq(schema.riskAlerts.year, year),
      ),
    });

    if (!existing) {
      await db.insert(schema.riskAlerts).values({
        userId: adminUser.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        month,
        year,
      });
    }
  }

  // Envia email para Luan + Franciele
  // RESEND_FROM_EMAIL já está no env. Os destinatários são configurados via env.
  const recipients = [
    adminUser.email,
    ...(process.env.PARTNER_EMAIL ? [process.env.PARTNER_EMAIL] : []),
  ];

  for (const email of recipients) {
    await sendRiskAlertsEmail(email, detected, month, year);
  }

  return NextResponse.json({ ok: true, alerts: detected.length, recipients: recipients.length });
}