import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// Endpoint to be used from email action links. Requires secret query param 's' matching EMAIL_ACTION_SECRET.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = parseInt(searchParams.get("id") || "0");
  const secret = searchParams.get("s") || "";

  if (!process.env.EMAIL_ACTION_SECRET || secret !== process.env.EMAIL_ACTION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

  // find future bill
  const f = await db.query.futureBills.findFirst({ where: and(eq(schema.futureBills.id, id)) });
  if (!f) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  // create bill in bills table using reminderDate if available
  const date = f.reminderDate ? new Date(f.reminderDate) : new Date();
  const [bill] = await db.insert(schema.bills).values({
    userId: f.userId,
    name: f.name,
    amount: f.amount || 0,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    dueDay: f.reminderDate ? date.getDate() : null,
    isPaid: false,
  }).returning();

  // mark future bill as notified
  await db.update(schema.futureBills).set({ notified: true }).where(eq(schema.futureBills.id, id));

  // redirect to contas page for that month/year
  const redirectUrl = `/contas?month=${bill.month}&year=${bill.year}`;
  return NextResponse.redirect(redirectUrl);
}
