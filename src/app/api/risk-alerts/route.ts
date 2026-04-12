// src/app/api/cron/risk-alerts/route.ts
// Roda toda segunda-feira às 8h (ver vercel.json)
// 1. Detecta riscos do mês atual vs anterior → persiste e envia email
// 2. Envia lembrete de check-in semanal para Luan + Franciele

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { detectRisks } from "@/lib/risk";
import { sendRiskAlertsEmail, sendCheckinReminderEmail } from "@/lib/email";

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const weekNumber = getISOWeek(now);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const adminUser = await db.query.users.findFirst();
  if (!adminUser) return NextResponse.json({ ok: true });

  const recipients = [
    adminUser.email,
    ...(process.env.PARTNER_EMAIL ? [process.env.PARTNER_EMAIL] : []),
  ];

  // ── 1. Alertas de risco ────────────────────────────────────────────────────
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

  if (detected.length > 0) {
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
    for (const email of recipients) {
      await sendRiskAlertsEmail(email, detected, month, year);
    }
  }

  // ── 2. Lembrete de check-in semanal ───────────────────────────────────────
  const pendingBillsList = currentBills.filter((b) => !b.isPaid);
  const pendingAmount = pendingBillsList.reduce((s, b) => s + b.amount, 0);
  const today = now.getDate();
  const dueSoon = currentBills
    .filter((b) => !b.isPaid && b.dueDay)
    .filter((b) => {
      const diff = (b.dueDay ?? 0) - today;
      return diff >= 0 && diff <= 5;
    })
    .sort((a, b) => (a.dueDay ?? 0) - (b.dueDay ?? 0))
    .slice(0, 4)
    .map((b) => ({ name: b.name, amount: b.amount, dueDay: b.dueDay! }));

  for (const email of recipients) {
    await sendCheckinReminderEmail(email, {
      weekNumber,
      month,
      year,
      pendingBills: pendingBillsList.length,
      pendingAmount,
      dueSoon,
    });
  }

  return NextResponse.json({
    ok: true,
    riskAlerts: detected.length,
    checkinReminderSent: recipients.length,
  });
}