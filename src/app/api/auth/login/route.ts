import { NextRequest, NextResponse } from "next/server";
import {
  createAuthorizationUrl,
  getCallbackUrl,
  getAppSession,
  oidc,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
 try {
   getCallbackUrl();
   const session = await getAppSession();
   const transaction = {
     state: oidc.randomState(),
     nonce: oidc.randomNonce(),
   };
   const authorizationUrl = await createAuthorizationUrl(transaction);
   session.authTransaction = transaction;
   await session.save();
   return NextResponse.redirect(authorizationUrl);
 } catch (error) {
   console.error(
     "Sign-in setup failed:",
     error instanceof Error ? error.name : "UnknownError",
   );
   return NextResponse.redirect(new URL("/setup", request.url));
 }
}
