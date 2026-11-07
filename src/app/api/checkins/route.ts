// src/app/api/checkins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import type { CheckinType } from "@/lib/db/schema";
import {
  computeSnapshot,
  getRevisaoStatus,
  parseCheckin,
  reviewedMonth,
  reviewedWeek,
  snoozeRevisao,
} from "@/lib/revisao";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const type = (searchParams.get("type") ?? "weekly") as CheckinType;
  const limit = Number.parseInt(searchParams.get("limit") ?? "8");

  const [checkins, status] = await Promise.all([
    db.query.weeklyCheckins.findMany({
      where: and(eq(schema.weeklyCheckins.userId, user.id), eq(schema.weeklyCheckins.type, type)),
      orderBy: [desc(schema.weeklyCheckins.createdAt)],
      limit,
    }),
    getRevisaoStatus(user.id),
  ]);

  return NextResponse.json({ checkins: checkins.map(parseCheckin), status });
}

// POST { type: 'weekly' | 'monthly', data } — grava a revisão da semana ISO anterior
// (upsert, uma por semana/tipo) com o snapshot dos números calculado aqui no servidor.
// POST { action: 'snooze' } — "adiar 2 horas", uma vez por semana.
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();

  if (body.action === "snooze") {
    const until = await snoozeRevisao(user.id);
    if (!until) return NextResponse.json({ error: "Adiamento já usado nesta semana" }, { status: 409 });
    return NextResponse.json({ until });
  }

  const type: CheckinType = body.type === "monthly" ? "monthly" : "weekly";
  const now = new Date();
  const week = reviewedWeek(now);
  const month = type === "monthly" ? reviewedMonth(now).month : now.getMonth() + 1;

  const snapshot = await computeSnapshot(user.id, now);
  const data = { ...(body.data ?? {}), snapshot };

  const existing = await db.query.weeklyCheckins.findFirst({
    where: and(
      eq(schema.weeklyCheckins.userId, user.id),
      eq(schema.weeklyCheckins.weekNumber, week.weekNumber),
      eq(schema.weeklyCheckins.year, week.isoYear),
      eq(schema.weeklyCheckins.type, type),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(schema.weeklyCheckins)
      .set({ data: JSON.stringify(data), month })
      .where(eq(schema.weeklyCheckins.id, existing.id))
      .returning();
    return NextResponse.json(parseCheckin(updated));
  }

  const [created] = await db
    .insert(schema.weeklyCheckins)
    .values({
      userId: user.id,
      weekNumber: week.weekNumber,
      month,
      year: week.isoYear,
      type,
      data: JSON.stringify(data),
    })
    .returning();

  return NextResponse.json(parseCheckin(created), { status: 201 });
}
