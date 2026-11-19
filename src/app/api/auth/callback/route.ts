import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getCallbackUrl,
  getRedis,
  redeemAuthorizationCode,
  saveUserSession,
  takeTransaction,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const transactionId = request.cookies.get("rvess.tx")?.value;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (!transactionId || !state) {
    return NextResponse.redirect(new URL("/?signin=failed", request.url));
  }

  try {
    getCallbackUrl();
    getRedis();
    const transaction = await takeTransaction(transactionId);
    if (!transaction || transaction.state !== state || error || !code) {
      const failed = NextResponse.redirect(
        new URL("/?signin=failed", request.url),
      );
      failed.cookies.delete("rvess.tx");
      return failed;
    }

    const user = await redeemAuthorizationCode(
      new URL(request.url),
      transaction,
    );
    const sessionId = randomBytes(32).toString("base64url");
    await saveUserSession(sessionId, user);

    const response = NextResponse.redirect(new URL("/account", request.url));
    response.cookies.delete("rvess.tx");
    response.cookies.set("rvess.sid", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch {
    const failed = NextResponse.redirect(
      new URL("/?signin=failed", request.url),
    );
    failed.cookies.delete("rvess.tx");
    return failed;
  }
}
