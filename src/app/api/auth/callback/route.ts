import { NextRequest, NextResponse } from "next/server";
import {
  getAppSession,
  getCallbackUrl,
  redeemAuthorizationCode,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let callbackOrigin: URL;
  try {
    callbackOrigin = new URL(getCallbackUrl());
  } catch {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const session = await getAppSession();
  const transaction = session.authTransaction;
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (!transaction || !state || transaction.state !== state) {
    return NextResponse.redirect(
      new URL("/?signin=failed", callbackOrigin.origin),
    );
  }

  delete session.authTransaction;
  await session.save();

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/?signin=failed", callbackOrigin.origin),
    );
  }

  try {
    const callbackUrl = new URL(getCallbackUrl());
    callbackUrl.search = request.nextUrl.search;
    session.user = await redeemAuthorizationCode(callbackUrl, transaction);
    await session.save();
    return NextResponse.redirect(new URL("/account", callbackOrigin.origin));
  } catch {
    return NextResponse.redirect(
      new URL("/?signin=failed", callbackOrigin.origin),
    );
  }
}
