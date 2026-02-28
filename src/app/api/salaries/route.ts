import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const month = parseInt(searchParams.get("month") || "0");
  const year = parseInt(searchParams.get("year") || "0");

  if (!month || !year) {
    return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  }

  const salaries = await db.query.salaries.findMany({
    where: and(
      eq(schema.salaries.userId, user.id),
      eq(schema.salaries.month, month),
      eq(schema.salaries.year, year)
    ),
  });

  return NextResponse.json(salaries);
}

export async function PUT(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { salaries, month, year } = await req.json();

  // Upsert salaries for the month
  for (const salary of salaries) {
    const existing = await db.query.salaries.findFirst({
      where: and(
        eq(schema.salaries.userId, user.id),
        eq(schema.salaries.month, month),
        eq(schema.salaries.year, year),
        eq(schema.salaries.person, salary.person)
      ),
    });

    if (existing) {
      await db.update(schema.salaries)
        .set({ amount: salary.amount })
        .where(eq(schema.salaries.id, existing.id));
    } else {
      await db.insert(schema.salaries).values({
        userId: user.id,
        person: salary.person,
        amount: salary.amount,
        month,
        year,
      });
    }
  }

  return NextResponse.json({ success: true });
}
