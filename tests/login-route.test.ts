import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const CONFIG = { user: "demo", password: "jel:szó:ő" };
const ORIGIN = "https://bankmonitor.vercel.app";

const post = (
  handler: (request: Request) => Promise<Response>,
  path: string,
  fields: Record<string, string> = {},
  origin: string | null = ORIGIN,
) =>
  handler(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: origin ? { origin } : {},
      body: new URLSearchParams(fields),
    }),
  );

const sessionCookie = (response: Response) =>
  response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));

describe("/api/login and /api/logout", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_USER", CONFIG.user);
    vi.stubEnv("DEMO_PASSWORD", CONFIG.password);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets a valid, httpOnly, secure session cookie and redirects to the target", async () => {
    const response = await post(login, "/api/login", {
      user: "demo",
      password: "jel:szó:ő",
      next: "/?q=1",
    });

    const cookie = sessionCookie(response) ?? "";
    const token = /^kb_session=([^;]+)/.exec(cookie)?.[1];
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/?q=1`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(verifySessionToken(token, CONFIG)).toBe(true);
  });

  it("sends a wrong password back to /login with an error and no cookie", async () => {
    const response = await post(login, "/api/login", {
      user: "demo",
      password: "rossz",
      next: "/valami",
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/login?error=1&next=%2Fvalami`,
    );
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("never redirects off-site after login", async () => {
    const targets = [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/api/chat",
    ];

    const locations = await Promise.all(
      targets.map(async (next) =>
        (
          await post(login, "/api/login", {
            user: "demo",
            password: "jel:szó:ő",
            next,
          })
        ).headers.get("location"),
      ),
    );

    expect(locations).toEqual(targets.map(() => `${ORIGIN}/`));
  });

  it("rejects cross-site or origin-less posts (login CSRF)", async () => {
    const fields = { user: "demo", password: "jel:szó:ő" };

    const crossSite = await post(
      login,
      "/api/login",
      fields,
      "https://evil.example",
    );
    const noOrigin = await post(login, "/api/login", fields, null);
    const logoutCrossSite = await post(
      logout,
      "/api/logout",
      {},
      "https://evil.example",
    );

    expect([crossSite.status, noOrigin.status, logoutCrossSite.status]).toEqual(
      [403, 403, 403],
    );
    expect(sessionCookie(crossSite)).toBeUndefined();
  });

  it("logs out by clearing the cookie and redirecting to /login", async () => {
    const response = await post(logout, "/api/logout");

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login`);
    expect(sessionCookie(response)).toMatch(
      /Max-Age=0|Expires=Thu, 01 Jan 1970/i,
    );
  });
});
