import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { uploadFileToDrive, deleteFileFromDrive } from "@/lib/cloudflare-r2";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type AttachmentType = "fatura" | "comprovante";

interface Attachments {
  fatura?: { fileId: string; url: string; name: string };
  comprovante?: { fileId: string; url: string; name: string };
}

function parseAttachments(raw: string | null): Attachments {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const billId = parseInt(params.id);
  const bill = await db.query.bills.findFirst({
    where: and(eq(schema.bills.id, billId), eq(schema.bills.userId, user.id)),
  });
  if (!bill) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const type = (formData.get("type") as AttachmentType) || "fatura";

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  if (!["fatura", "comprovante"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const subFolder = `${bill.year}/${MONTHS[bill.month - 1]}`;
  const ext = file.name.split(".").pop();
  const fileName = `${bill.name}_${type}_${bill.month}-${bill.year}_${Date.now()}.${ext}`;

  const { fileId, webViewLink } = await uploadFileToDrive(fileName, file.type, buffer, subFolder);

  const attachments = parseAttachments((bill as any).attachments);

  // Se já tinha arquivo desse tipo, remove o antigo
  if (attachments[type]?.fileId) {
    await deleteFileFromDrive(attachments[type]!.fileId).catch(() => { });
  }

  attachments[type] = { fileId, url: webViewLink, name: file.name };

  await db.update(schema.bills)
    .set({ attachments: JSON.stringify(attachments) } as any)
    .where(eq(schema.bills.id, billId));

  return NextResponse.json({ fileId, url: webViewLink, type });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const billId = parseInt(params.id);
  const bill = await db.query.bills.findFirst({
    where: and(eq(schema.bills.id, billId), eq(schema.bills.userId, user.id)),
  });
  if (!bill) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const type = (searchParams.get("type") as AttachmentType) || "fatura";

  const attachments = parseAttachments((bill as any).attachments);
  if (attachments[type]?.fileId) {
    await deleteFileFromDrive(attachments[type]!.fileId).catch(() => { });
    delete attachments[type];
  }

  await db.update(schema.bills)
    .set({ attachments: JSON.stringify(attachments) } as any)
    .where(eq(schema.bills.id, billId));

  return NextResponse.json({ success: true });
}