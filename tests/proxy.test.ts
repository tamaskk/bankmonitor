import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

const basic = (credentials: string) =>
  `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;

const request = (authorization?: string) =>
  new NextRequest("http://localhost:3000/api/banks", {
    headers: authorization ? { authorization } : {},
  });

describe("proxy (Basic Auth)", () => {
  const saved = {
    user: process.env.DEMO_USER,
    password: process.env.DEMO_PASSWORD,
  };

  beforeEach(() => {
    process.env.DEMO_USER = "demo";
    process.env.DEMO_PASSWORD = "jel:szó:ő"; // colons and non-ASCII on purpose
  });

  afterEach(() => {
    process.env.DEMO_USER = saved.user;
    process.env.DEMO_PASSWORD = saved.password;
  });

  it("asks for credentials with 401 and a Basic challenge when none are sent", () => {
    const response = proxy(request());

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Basic realm="kb-assistant", charset="UTF-8"',
    );
  });

  it("rejects a wrong password and a wrong user", () => {
    const wrongPassword = proxy(request(basic("demo:rossz")));
    const wrongUser = proxy(request(basic("mas:jel:szó:ő")));
    const garbage = proxy(request("Basic !!!"));

    expect([wrongPassword.status, wrongUser.status, garbage.status]).toEqual([
      401, 401, 401,
    ]);
  });

  it("lets the request through with the right credentials, splitting at the first colon", () => {
    const response = proxy(request(basic("demo:jel:szó:ő")));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed with 500 when a credential is not configured", () => {
    delete process.env.DEMO_PASSWORD;

    const response = proxy(request(basic("demo:jel:szó:ő")));

    expect(response.status).toBe(500);
  });
});
