import { NextRequest, NextResponse } from "next/server";
import { destroyUserSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("rvess.sid")?.value;
  try {
    await destroyUserSession(sessionId);
  } catch {
    return new NextResponse("Sign-out failed. Please try again.", {
      status: 500,
    });
  }
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete("rvess.sid");
  return response;
}
