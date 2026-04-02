import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { verifyPasswordResetToken, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    let body: any = {};
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (parseErr) {
        console.error("/api/auth/reset parse error:", parseErr, "raw:", raw.slice(0, 100));
        return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
      }
    }

    const { token, password } = body;

    if (!token || !password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ ok: false, message: "invalid" }, { status: 400 });
    }

    const userId = await verifyPasswordResetToken(token);
    if (!userId) {
      return NextResponse.json({ ok: false, message: "invalid or expired token" }, { status: 400 });
    }

    const newHash = await hashPassword(password);

    await db.update(schema.users).set({ passwordHash: newHash }).where(eq(schema.users.id, userId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/auth/reset error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
