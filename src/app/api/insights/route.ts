// Insights da semana: leitura, voto útil / não útil e regeneração manual.
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateWeeklyInsights, latestInsights } from "@/lib/insights";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(await latestInsights(user.id));
}

export const maxDuration = 30;

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(await generateWeeklyInsights(user.id));
}

// PATCH { id, vote: 1 | -1 | null }
export async function PATCH(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, vote } = await req.json();
  if (!id || ![1, -1, null].includes(vote)) return NextResponse.json({ error: "id e vote (1, -1 ou null)" }, { status: 400 });
  await db
    .update(schema.insights)
    .set({ vote })
    .where(and(eq(schema.insights.id, Number(id)), eq(schema.insights.userId, user.id)));
  return NextResponse.json({ success: true });
}
