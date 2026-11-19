import { NextRequest, NextResponse } from "next/server";
import { getAppSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getAppSession();
  session.destroy();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
