import { describe, expect, it } from "vitest";
import { generatePersonalToken, hashPersonalToken } from "./personalTokens.ts";

describe("generatePersonalToken", () => {
  it("prefixes 32 random bytes in base64url", () => {
    expect(generatePersonalToken().token).toMatch(/^rfp_[\w-]{43}$/);
  });

  it("hashes the full token in sha-256 hex", () => {
    const { token, hash } = generatePersonalToken();
    expect(hash).toMatch(/^[\da-f]{64}$/);
    expect(hash).toBe(hashPersonalToken(token));
  });

  it("keeps the first 4 characters of the secret as prefix", () => {
    const { token, prefix } = generatePersonalToken();
    expect(prefix).toBe(token.slice(0, 8));
  });

  it("never generates the same token twice", () => {
    expect(generatePersonalToken().token).not.toBe(
      generatePersonalToken().token,
    );
  });
});
