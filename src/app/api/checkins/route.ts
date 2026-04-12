// src/app/api/checkins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import type { CheckinType } from "@/lib/db/schema";

// Retorna o número da semana ISO para uma data
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const type = (searchParams.get("type") ?? "weekly") as CheckinType;
  const limit = Number.parseInt(searchParams.get("limit") ?? "8");

  const checkins = await db.query.weeklyCheckins.findMany({
    where: and(
      eq(schema.weeklyCheckins.userId, user.id),
      eq(schema.weeklyCheckins.type, type),
    ),
    orderBy: [desc(schema.weeklyCheckins.createdAt)],
    limit,
  });

  // Verifica se já existe check-in para a semana atual
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const doneThisWeek = checkins.some(
    (c) => c.weekNumber === currentWeek && c.year === currentYear && c.type === type,
  );

  return NextResponse.json({
    checkins: checkins.map((c) => ({
      ...c,
      data: JSON.parse(c.data),
    })),
    meta: {
      currentWeek,
      currentMonth,
      currentYear,
      doneThisWeek,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { type = "weekly", data } = body;

  const now = new Date();
  const weekNumber = getISOWeek(now);
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Upsert — apenas um check-in por semana por tipo
  const existing = await db.query.weeklyCheckins.findFirst({
    where: and(
      eq(schema.weeklyCheckins.userId, user.id),
      eq(schema.weeklyCheckins.weekNumber, weekNumber),
      eq(schema.weeklyCheckins.year, year),
      eq(schema.weeklyCheckins.type, type),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(schema.weeklyCheckins)
      .set({ data: JSON.stringify(data) })
      .where(eq(schema.weeklyCheckins.id, existing.id))
      .returning();
    return NextResponse.json({ ...updated, data });
  }

  const [created] = await db
    .insert(schema.weeklyCheckins)
    .values({
      userId: user.id,
      weekNumber,
      month,
      year,
      type,
      data: JSON.stringify(data),
    })
    .returning();

  return NextResponse.json({ ...created, data }, { status: 201 });
}