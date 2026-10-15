import { NextResponse } from "next/server";

import {
  createSessionToken,
  credentialsMatch,
  getAuthConfig,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/session";

// Slows down password guessing against the public URL; Vercel functions are
// stateless, so a per-IP counter would need extra infrastructure.
const FAILED_LOGIN_DELAY_MS = 500;

const sameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
};

// A plain HTML form posts here, so the login works without JavaScript.
export async function POST(request: Request) {
  // A cross-site form must not be able to log the browser in (login CSRF).
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 403 });
  }
  const config = getAuthConfig();
  if (!config) {
    return new NextResponse("Hiányzó szerverkonfiguráció", { status: 500 });
  }

  const form = await request.formData().catch(() => null);
  const field = (name: string) => {
    const value = form?.get(name);
    return typeof value === "string" ? value : "";
  };
  const next = safeNextPath(field("next"));

  if (!credentialsMatch(field("user"), field("password"), config)) {
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    const back = new URL("/login", request.url);
    back.searchParams.set("error", "1");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(SESSION_COOKIE, createSessionToken(config), {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
