import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateEmailToken, savePasswordResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    console.log("/api/auth/forgot received body:", raw.slice(0, 100));
    let body: any = {};
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch (parseErr) {
        console.error("/api/auth/forgot parse error:", parseErr, "raw:", raw.slice(0, 100));
        return NextResponse.json({ ok: false, message: "invalid JSON" }, { status: 400 });
      }
    }

    const email = (body.email || "").toString().trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ ok: false, message: "email required" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });

    // Always respond 200 to avoid leaking whether email exists
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = await generateEmailToken();
    await savePasswordResetToken(user.id, token);

    // send email (fire and forget)
    sendPasswordResetEmail(email, token).catch((err) => console.error("sendPasswordResetEmail error:", err));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/auth/forgot error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
