import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

// T-018: Basic Auth for every page and API route. The URL and the repo are
// public and every question costs OpenAI calls, so the demo stays closed
// even though it is "only a demo" (ARCHITECTURE.md §06). Proxy runs on the
// Node.js runtime in Next.js 16, so node:crypto is available.

const REALM = 'Basic realm="kb-assistant", charset="UTF-8"';

// Hash both sides first: the digests always have the same length, so
// timingSafeEqual never throws and the comparison leaks neither content nor length.
function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) =>
    createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

function parseBasicAuth(
  header: string | null,
): { user: string; password: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  // UTF-8 rather than atob(): atob() mangles non-ASCII passwords.
  const decoded = Buffer.from(
    header.slice("Basic ".length).trim(),
    "base64",
  ).toString("utf8");
  const separator = decoded.indexOf(":"); // first colon: the password may contain more
  if (separator === -1) return null;
  return {
    user: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

export function proxy(request: NextRequest) {
  const expectedUser = process.env.DEMO_USER;
  const expectedPassword = process.env.DEMO_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    // Fail closed: a deployment without credentials must not be open.
    return new NextResponse("Hiányzó szerverkonfiguráció", { status: 500 });
  }

  const credentials = parseBasicAuth(request.headers.get("authorization"));
  // Both comparisons always run, so timing does not reveal which part was wrong.
  const userOk = credentials
    ? safeEqual(credentials.user, expectedUser)
    : false;
  const passwordOk = credentials
    ? safeEqual(credentials.password, expectedPassword)
    : false;
  if (userOk && passwordOk) return NextResponse.next();

  return new NextResponse("Hitelesítés szükséges", {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
