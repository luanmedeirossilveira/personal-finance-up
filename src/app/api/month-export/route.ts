// Markdown do mês (contas, compras, categorias, dívidas, parcelas e comparação com os meses
// anteriores) para colar numa conversa com o Claude.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { collectMonthExport, renderMonthExport } from "@/lib/month-export";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const month = Number(req.nextUrl.searchParams.get("month"));
  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!month || !year) return NextResponse.json({ error: "month e year são obrigatórios" }, { status: 400 });
  const markdown = renderMonthExport(await collectMonthExport(user.id, month, year));
  return new NextResponse(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
