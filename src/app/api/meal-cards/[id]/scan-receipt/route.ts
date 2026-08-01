// src/app/api/meal-cards/[id]/scan-receipt/route.ts
// Recebe a imagem de um cupom/nota e usa a IA de visão (VISION_FALLBACK_*) para extrair os itens.
// NÃO persiste nada: devolve os dados extraídos para o usuário revisar antes de salvar.
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import {
  extractReceipt,
  NoReceiptProviderError,
  SUPPORTED_IMAGE_TYPES,
  type SupportedImageMediaType,
} from "@/lib/receipt";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const cardId = Number.parseInt(params.id);
  const card = await db.query.mealCards.findFirst({
    where: and(
      eq(schema.mealCards.id, cardId),
      eq(schema.mealCards.userId, user.id),
    ),
  });
  if (!card) return NextResponse.json({ error: "Cartão não encontrado" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo de imagem obrigatório" }, { status: 400 });
  }

  const mediaType = file.type as SupportedImageMediaType;
  if (!SUPPORTED_IMAGE_TYPES.includes(mediaType)) {
    return NextResponse.json(
      { error: "Formato não suportado. Use JPEG, PNG, WEBP ou GIF." },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "Imagem vazia" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máx. 8 MB)" }, { status: 413 });
  }

  try {
    const receipt = await extractReceipt(bytes.toString("base64"), mediaType);
    return NextResponse.json(receipt);
  } catch (error) {
    if (error instanceof NoReceiptProviderError) {
      return NextResponse.json(
        { error: "Leitura por imagem indisponível: configure VISION_FALLBACK_URL/KEY/MODEL." },
        { status: 503 },
      );
    }
    console.error("Erro ao ler cupom:", error);
    return NextResponse.json({ error: "Não foi possível ler a imagem." }, { status: 502 });
  }
}
