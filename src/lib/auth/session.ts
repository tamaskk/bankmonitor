import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Demo login: one shared user from DEMO_USER / DEMO_PASSWORD. A successful
// login sets a signed, expiring session cookie; the proxy checks it on every
// request. The signing key is derived from the credentials themselves, so no
// extra secret is needed and changing the password invalidates every session.
// Imported by src/proxy.ts and the login routes only (never by client code);
// no `server-only` import because the proxy is not bundled with that condition.

export const SESSION_COOKIE = "kb_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type AuthConfig = { user: string; password: string };

/** The configured credentials, or null when either is missing or blank (fail closed). */
export function getAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig | null {
  const user = env.DEMO_USER;
  const password = env.DEMO_PASSWORD;
  if (!user?.trim() || !password?.trim()) return null;
  return { user, password };
}

// Hash both sides first: the digests always have the same length, so
// timingSafeEqual never throws and leaks neither content nor length.
function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) =>
    createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** Both comparisons always run, so timing does not reveal which part was wrong. */
export function credentialsMatch(
  user: string,
  password: string,
  config: AuthConfig,
): boolean {
  const userOk = safeEqual(user, config.user);
  const passwordOk = safeEqual(password, config.password);
  return userOk && passwordOk;
}

/** `Authorization: Basic …` (scheme case-insensitive, split at the first colon), for curl and scripts. */
export function parseBasicAuth(
  header: string | null,
): { user: string; password: string } | null {
  const match = /^basic\s+(\S+)\s*$/i.exec(header ?? "");
  if (!match) return null;
  // UTF-8 rather than atob(): atob() mangles non-ASCII passwords.
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator === -1) return null;
  return {
    user: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

function signature(expiresAt: number, config: AuthConfig): string {
  const key = createHash("sha256")
    .update(
      `kb-assistant session v1\0${config.user}\0${config.password}`,
      "utf8",
    )
    .digest();
  return createHmac("sha256", key)
    .update(String(expiresAt))
    .digest("base64url");
}

/** `<expires-at-unix-seconds>.<hmac>` */
export function createSessionToken(
  config: AuthConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const expiresAt = nowSeconds + SESSION_TTL_SECONDS;
  return `${expiresAt}.${signature(expiresAt, config)}`;
}

export function verifySessionToken(
  token: string | undefined,
  config: AuthConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const match = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(token ?? "");
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt <= nowSeconds) return false;
  return safeEqual(match[2], signature(expiresAt, config));
}

/** A same-site relative path to return to after login; anything else falls back to "/". */
export function safeNextPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  )
    return "/";
  if (next.startsWith("/login") || next.startsWith("/api/")) return "/";
  return next;
}
