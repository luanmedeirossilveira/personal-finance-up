import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken, createSession, setSessionCookie } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  try {
    const userId = await verifyEmailToken(token);

    if (!userId) {
      return NextResponse.redirect(new URL("/login?error=expired_token", req.url));
    }

    const sessionToken = await createSession(userId);
    await setSessionCookie(sessionToken);

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error) {
    console.error("Email verify error:", error);
    return NextResponse.redirect(new URL("/login?error=server_error", req.url));
  }
}
