import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { proxy } from "@/proxy";

const CONFIG = { user: "demo", password: "jel:szó:ő" }; // colons and non-ASCII on purpose

const basic = (credentials: string, scheme = "Basic") =>
  `${scheme} ${Buffer.from(credentials, "utf8").toString("base64")}`;

const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers });

const withSession = (token = createSessionToken(CONFIG)) => ({
  cookie: `${SESSION_COOKIE}=${token}`,
});

describe("proxy (login wall)", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_USER", CONFIG.user);
    vi.stubEnv("DEMO_PASSWORD", CONFIG.password);
  });

  // Restores the real values, or removes the variables if they were unset.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects a page request without a session to /login, keeping the target", () => {
    const home = proxy(request("/"));
    const deep = proxy(request("/valami?x=1"));

    expect(home.status).toBe(307);
    expect(home.headers.get("location")).toBe("http://localhost:3000/login");
    expect(deep.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fvalami%3Fx%3D1",
    );
  });

  it("answers an API request without a session with 401 JSON and no browser challenge", async () => {
    const response = proxy(request("/api/banks"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(await response.json()).toEqual({
      error: "Bejelentkezés szükséges.",
    });
  });

  it("lets a valid session cookie through", () => {
    const page = proxy(request("/", withSession()));
    const api = proxy(request("/api/chat", withSession()));

    expect(page.headers.get("x-middleware-next")).toBe("1");
    expect(api.headers.get("x-middleware-next")).toBe("1");
  });

  it("rejects a tampered, expired or foreign-key session cookie", () => {
    const [expiresAt, sig] = createSessionToken(CONFIG).split(".");
    const tampered = `${Number(expiresAt) + 9999}.${sig}`;
    const expired = createSessionToken(
      CONFIG,
      Math.floor(Date.now() / 1000) - 13 * 60 * 60,
    );
    const foreign = createSessionToken({ user: "demo", password: "másik" });

    const statuses = [tampered, expired, foreign, "szemét"].map(
      (token) => proxy(request("/api/banks", withSession(token))).status,
    );

    expect(statuses).toEqual([401, 401, 401, 401]);
  });

  it("still accepts Basic credentials from scripts, in any scheme case, and rejects wrong ones", () => {
    const ok = proxy(
      request("/api/banks", {
        authorization: basic("demo:jel:szó:ő", "basic"),
      }),
    );
    const wrong = [
      basic("demo:rossz"),
      basic("mas:jel:szó:ő"),
      "Basic !!!",
      basic("demojelszo"),
      basic("demo:jel:szó:ő", "Bearer"),
    ].map(
      (authorization) => proxy(request("/api/banks", { authorization })).status,
    );

    expect(ok.headers.get("x-middleware-next")).toBe("1");
    expect(wrong).toEqual([401, 401, 401, 401, 401]);
  });

  it("keeps /login and the auth routes public, and sends signed-in users from /login to /", () => {
    const loginPage = proxy(request("/login"));
    const loginApi = proxy(request("/api/login"));
    const logoutApi = proxy(request("/api/logout"));
    const signedIn = proxy(request("/login", withSession()));

    expect(loginPage.headers.get("x-middleware-next")).toBe("1");
    expect(loginApi.headers.get("x-middleware-next")).toBe("1");
    expect(logoutApi.headers.get("x-middleware-next")).toBe("1");
    expect(signedIn.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("fails closed with 500 when a credential is missing or blank", () => {
    vi.stubEnv("DEMO_PASSWORD", undefined);
    const missing = proxy(request("/login"));
    vi.stubEnv("DEMO_PASSWORD", CONFIG.password);
    vi.stubEnv("DEMO_USER", "   ");
    const blank = proxy(request("/"));

    expect([missing.status, blank.status]).toEqual([500, 500]);
  });
});
