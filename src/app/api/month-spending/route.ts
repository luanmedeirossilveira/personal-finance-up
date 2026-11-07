// Tudo o que saiu no mês, por categoria: contas, compras do cartão de crédito (abrindo a fatura)
// e cartões alimentação. Base da aba Categorias e do fechamento do mês.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMonthSpending } from "@/lib/month-spending";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const month = Number(req.nextUrl.searchParams.get("month"));
  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!month || !year) return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  return NextResponse.json(await getMonthSpending(user.id, month, year));
}
