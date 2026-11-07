// Importar extrato OFX/CSV (contas dela). Sem `commit`: devolve a prévia com duplicadas marcadas.
// Com `commit=true`: salva em bank_transactions (source = 'import', ownership da conta) e concilia.
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseStatement } from "@/lib/import/statement";
import { reconcilePending } from "@/lib/reconcile";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const accountId = Number(form.get("accountId"));
  const commit = form.get("commit") === "true";
  const skip = new Set(String(form.get("skip") ?? "").split(",").filter(Boolean));
  const categories: Record<string, string> = JSON.parse(String(form.get("categories") ?? "{}"));

  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Arquivo maior que 2 MB" }, { status: 413 });

  const account = await db.query.accounts.findFirst({
    where: and(eq(schema.accounts.id, accountId), eq(schema.accounts.userId, user.id)),
  });
  if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  // OFX de banco brasileiro costuma vir em latin1.
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = buffer.toString("utf8");
  if (text.includes("�")) text = buffer.toString("latin1");

  const parsed = parseStatement(file.name, text);
  if (parsed.length === 0) return NextResponse.json({ error: "Nenhuma transação reconhecida no arquivo" }, { status: 422 });

  const existing = await db.query.bankTransactions.findMany({
    where: and(
      eq(schema.bankTransactions.userId, user.id),
      eq(schema.bankTransactions.source, "import"),
      inArray(schema.bankTransactions.externalId, parsed.map((p) => p.externalId)),
    ),
  });
  const seen = new Set(existing.map((e) => e.externalId));
  const preview = parsed.map((p) => ({ ...p, duplicate: seen.has(p.externalId) }));

  if (!commit) return NextResponse.json({ account: { id: account.id, name: account.name }, transactions: preview });

  const toSave = preview.filter((p) => !p.duplicate && !skip.has(p.externalId));
  for (const p of toSave) {
    await db
      .insert(schema.bankTransactions)
      .values({
        userId: user.id,
        accountId: account.id,
        source: "import",
        externalId: p.externalId,
        date: p.date,
        amount: p.amount,
        description: p.description,
        category: categories[p.externalId] ?? p.category,
        ownership: account.ownership,
      })
      .onConflictDoNothing();
  }
  await db
    .update(schema.accounts)
    .set({ lastImportAt: new Date().toISOString() })
    .where(eq(schema.accounts.id, account.id));
  const matched = await reconcilePending(user.id);

  return NextResponse.json({ saved: toSave.length, duplicates: preview.length - toSave.length, matched });
}
