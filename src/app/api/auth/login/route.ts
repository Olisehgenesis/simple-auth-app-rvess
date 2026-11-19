import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createAuthorizationUrl,
  getCallbackUrl,
  getRedis,
  oidc,
  saveTransaction,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  try {
    getCallbackUrl();
    getRedis();
    const transactionId = randomBytes(32).toString("base64url");
    const transaction = {
      state: oidc.randomState(),
      nonce: oidc.randomNonce(),
      codeVerifier: oidc.randomPKCECodeVerifier(),
    };
    const authorizationUrl = await createAuthorizationUrl(transaction);
    await saveTransaction(transactionId, transaction);

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set("rvess.tx", transactionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/setup", _request.url));
  }
}
