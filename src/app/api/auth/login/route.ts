import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  verifyPassword,
  generateEmailToken,
  saveEmailVerifyToken,
  createSession,
  setSessionCookie,
} from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
    }

    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: "Acesso não autorizado" }, { status: 403 });
    }

    // Find or check user
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, email.toLowerCase()),
    });

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado. Configure o admin." }, { status: 404 });
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json({ error: "Senha não configurada. Use o script de setup." }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    }

    // Check if this is first access or token needs renewal (30 days)
    const recentSession = await db.query.authTokens.findFirst({
      where: eq(schema.authTokens.userId, user.id),
    });

    // Check last verified session - if none or expired > 30 days, require email verify
    const lastVerified = await db.query.authTokens.findFirst({
      where: eq(schema.authTokens.userId, user.id),
    });

    // For simplicity: if no session token in DB, or user hasn't verified email recently, send verification
    // We'll use a flag in the session token about email verification
    const hasValidSession = await db.query.authTokens.findFirst({
      where: (tokens, { eq, and, gt }) =>
        and(
          eq(tokens.userId, user!.id),
          eq(tokens.type, "session"),
          gt(tokens.expiresAt, new Date().toISOString())
        ),
    });

    if (hasValidSession) {
      // Just create a new session
      const token = await createSession(user.id);
      await setSessionCookie(token);
      return NextResponse.json({ success: true });
    }

    // Require email verification
    const verifyToken = await generateEmailToken();
    await saveEmailVerifyToken(user.id, verifyToken);
    try {
      await sendVerificationEmail(email, verifyToken);
    } catch (err) {
      console.error("Failed to send verification email:", err);
      return NextResponse.json({ error: "Falha ao enviar email de verificação" }, { status: 500 });
    }

    return NextResponse.json({ requiresVerification: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
