// Fechamento do mês: GET ?month&year (status), POST { month, year } fecha, DELETE ?month&year reabre.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ClosingError, closeMonth, getClosing, getWorkingPeriod, reopenMonth } from "@/lib/month-closing";

function period(sp: URLSearchParams) {
  return { month: Number(sp.get("month")), year: Number(sp.get("year")) };
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { month, year } = period(req.nextUrl.searchParams);
  if (!month || !year) return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  try {
    const [closing, working] = await Promise.all([getClosing(user.id, month, year), getWorkingPeriod(user.id)]);
    return NextResponse.json({ closing, working });
  } catch {
    return NextResponse.json({ closing: null, working: null, unavailable: true });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { month, year } = await req.json();
  if (!month || !year) return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  try {
    const closing = await closeMonth(user.id, Number(month), Number(year));
    return NextResponse.json({ closing, working: await getWorkingPeriod(user.id) }, { status: 201 });
  } catch (e) {
    if (e instanceof ClosingError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Fechar mês:", e);
    return NextResponse.json({ error: "Não foi possível fechar o mês (a migration 0020 foi aplicada?)" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { month, year } = period(req.nextUrl.searchParams);
  if (!month || !year) return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  await reopenMonth(user.id, month, year);
  return NextResponse.json({ success: true });
}
