import { NextResponse, type NextRequest } from "next/server";

import {
  credentialsMatch,
  getAuthConfig,
  parseBasicAuth,
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";

// Login wall for every page and API route. The URL and the repo are public
// and every question costs OpenAI calls, so the demo stays closed
// (ARCHITECTURE.md §06). Browsers sign in on /login and get a signed session
// cookie; curl and scripts may still send `Authorization: Basic`. No
// `WWW-Authenticate` challenge is sent, so the browser's own credential
// dialog never appears. Proxy runs on the Node.js runtime in Next.js 16.

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout"]);

export function proxy(request: NextRequest) {
  const config = getAuthConfig();
  if (!config) {
    // Fail closed: a deployment without credentials must not be open.
    return new NextResponse("Hiányzó szerverkonfiguráció", { status: 500 });
  }

  const { pathname, search } = request.nextUrl;
  const sessionOk = verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
    config,
  );
  const basic = parseBasicAuth(request.headers.get("authorization"));
  const authenticated =
    sessionOk ||
    (basic !== null && credentialsMatch(basic.user, basic.password, config));

  if (PUBLIC_PATHS.has(pathname)) {
    // Signed-in users skip the login form.
    if (pathname === "/login" && authenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Bejelentkezés szükséges." },
      { status: 401 },
    );
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Exact exclusions only: a bare prefix would also skip e.g. /favicon.icoX.
  matcher: ["/((?!_next/static/|_next/image$|favicon\\.ico$).*)"],
};
