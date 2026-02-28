import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const SESSION_COOKIE = "contas_session";
const SESSION_DURATION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateEmailToken(): Promise<string> {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(userId: number): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const token = await new SignJWT({ userId, expiresAt: expiresAt.toISOString() })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(JWT_SECRET);

  // Store session token in DB
  await db.insert(schema.authTokens).values({
    userId,
    token,
    type: "session",
    expiresAt: expiresAt.toISOString(),
  });

  return token;
}

export async function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as number;

    // Verify token exists in DB and isn't expired
    const dbToken = await db.query.authTokens.findFirst({
      where: and(
        eq(schema.authTokens.token, token),
        eq(schema.authTokens.type, "session"),
        gt(schema.authTokens.expiresAt, new Date().toISOString())
      ),
    });

    if (!dbToken) return null;

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    return user || null;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db
      .delete(schema.authTokens)
      .where(eq(schema.authTokens.token, token))
      .catch(() => {});
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function saveEmailVerifyToken(
  userId: number,
  token: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24h expiry

  // Invalidate previous tokens
  await db
    .delete(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.userId, userId),
        eq(schema.authTokens.type, "email_verify")
      )
    );

  await db.insert(schema.authTokens).values({
    userId,
    token,
    type: "email_verify",
    expiresAt: expiresAt.toISOString(),
  });
}

export async function verifyEmailToken(token: string) {
  const dbToken = await db.query.authTokens.findFirst({
    where: and(
      eq(schema.authTokens.token, token),
      eq(schema.authTokens.type, "email_verify"),
      gt(schema.authTokens.expiresAt, new Date().toISOString())
    )
  });

  if (!dbToken) return null;

  // Mark as used
  await db
    .delete(schema.authTokens)
    .where(eq(schema.authTokens.id, dbToken.id));

  return dbToken.userId;
}
