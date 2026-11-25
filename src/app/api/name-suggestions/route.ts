// src/app/api/name-suggestions/route.ts
// GET ?source=bill|card|meal → descrições já usadas (com categoria e valor) para o autocomplete.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNameSuggestions } from "@/lib/name-suggestions";
import { SUGGESTION_SOURCES, type SuggestionSource } from "@/lib/name-suggestions-shared";

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const source = req.nextUrl.searchParams.get("source") as SuggestionSource | null;
  if (!source || !SUGGESTION_SOURCES.includes(source)) {
    return NextResponse.json({ error: "source deve ser bill, card ou meal" }, { status: 400 });
  }

  return NextResponse.json(await getNameSuggestions(user.id, source));
}
