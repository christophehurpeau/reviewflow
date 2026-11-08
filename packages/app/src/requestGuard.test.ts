import { describe, expect, test } from "vitest";
import type { JudgedRequest } from "./requestGuard.ts";
import { judgeRequest } from "./requestGuard.ts";

const judge = (request: Partial<JudgedRequest>) =>
  judgeRequest({ api: true, allowDevOrigins: false, ...request });

describe("judgeRequest", () => {
  test("accepts loopback hosts on any port and no origin", () => {
    for (const host of [
      "127.0.0.1:7450",
      "localhost:9",
      "[::1]:7450",
      "LOCALHOST",
    ]) {
      expect(judge({ host })).toEqual({
        allowed: true,
        corsOrigin: null,
      });
    }
  });

  test("refuses a foreign host (dns rebinding)", () => {
    expect(judge({ host: "evil.example:7450" }).allowed).toBe(false);
    expect(judge({ host: "127.0.0.1.evil.example" }).allowed).toBe(false);
  });

  test("echoes the server's own origin", () => {
    expect(
      judge({ host: "127.0.0.1:7450", origin: "http://127.0.0.1:7450" }),
    ).toEqual({
      allowed: true,
      corsOrigin: "http://127.0.0.1:7450",
    });
  });

  test("echoes the expo dev origins only in dev", () => {
    for (const origin of ["http://localhost:8085", "http://127.0.0.1:8085"]) {
      expect(
        judge({ host: "localhost:7450", origin, allowDevOrigins: true }),
      ).toEqual({ allowed: true, corsOrigin: origin });
      expect(judge({ host: "localhost:7450", origin }).allowed).toBe(false);
    }
  });

  test("refuses a foreign origin, another port, or https", () => {
    for (const origin of [
      "https://evil.example",
      "http://localhost:3000",
      "http://localhost:8081",
      "https://localhost:8085",
      "null",
    ]) {
      expect(
        judge({ host: "127.0.0.1:7450", origin, allowDevOrigins: true })
          .allowed,
      ).toBe(false);
    }
  });

  test("refuses an api GET a foreign page sends without origin", () => {
    for (const secFetchSite of ["cross-site", "same-site"]) {
      expect(judge({ host: "127.0.0.1:7450", secFetchSite }).allowed).toBe(
        false,
      );
    }
  });

  test("lets a foreign link open a page, and same-origin or typed requests through", () => {
    expect(
      judge({ host: "127.0.0.1:7450", secFetchSite: "cross-site", api: false })
        .allowed,
    ).toBe(true);
    for (const secFetchSite of ["same-origin", "none"]) {
      expect(judge({ host: "127.0.0.1:7450", secFetchSite }).allowed).toBe(
        true,
      );
    }
  });
});
