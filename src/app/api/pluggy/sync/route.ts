// "Sincronizar agora" em Patrimônio.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncUser } from "@/lib/pluggy/sync";

export const maxDuration = 60;

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const result = await syncUser(user.id);
  return NextResponse.json(result);
}
