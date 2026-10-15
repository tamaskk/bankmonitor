import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin === null || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 403 });
  }
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
