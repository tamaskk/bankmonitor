import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

const basic = (credentials: string, scheme = "Basic") =>
  `${scheme} ${Buffer.from(credentials, "utf8").toString("base64")}`;

const request = (authorization?: string) =>
  new NextRequest("http://localhost:3000/api/banks", {
    headers: authorization ? { authorization } : {},
  });

describe("proxy (Basic Auth)", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_USER", "demo");
    vi.stubEnv("DEMO_PASSWORD", "jel:szó:ő"); // colons and non-ASCII on purpose
  });

  // Restores the real values, or removes the variables if they were unset.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("asks for credentials with 401 and a Basic challenge when none are sent", () => {
    const response = proxy(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="kb-assistant", charset="UTF-8"',
    );
  });

  it("rejects a wrong password, a wrong user and malformed headers", () => {
    const responses = [
      proxy(request(basic("demo:rossz"))),
      proxy(request(basic("mas:jel:szó:ő"))),
      proxy(request("Basic !!!")),
      proxy(request(basic("demojelszo"))), // no colon
      proxy(request(basic("demo:jel:szó:ő", "Bearer"))), // other scheme
    ];

    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
  });

  it("lets the request through with the right credentials, splitting at the first colon", () => {
    const response = proxy(request(basic("demo:jel:szó:ő")));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("accepts the scheme name in any case", () => {
    const response = proxy(request(basic("demo:jel:szó:ő", "basic")));

    expect(response.status).toBe(200);
  });

  it("fails closed with 500 when the password is not configured", () => {
    vi.stubEnv("DEMO_PASSWORD", undefined);

    const response = proxy(request(basic("demo:jel:szó:ő")));

    expect(response.status).toBe(500);
  });

  it("fails closed with 500 when the user is missing or blank", () => {
    vi.stubEnv("DEMO_USER", undefined);
    const missing = proxy(request(basic("demo:jel:szó:ő")));
    vi.stubEnv("DEMO_USER", "   ");
    const blank = proxy(request(basic("   :jel:szó:ő")));

    expect([missing.status, blank.status]).toEqual([500, 500]);
  });
});
