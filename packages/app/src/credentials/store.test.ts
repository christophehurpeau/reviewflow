/* oxlint-disable typescript/require-await, unicorn/no-await-expression-member, typescript/consistent-type-assertions, eslint/object-shorthand, eslint/func-names, eslint/no-loop-func, typescript/only-throw-error, eslint/no-bitwise, import/no-duplicates */
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createMemoryCredentialKey as memoryKey } from "./memoryKey.test-utils.ts";
import {
  createFileCredentialStore,
  credentialsUnreadableCode,
} from "./store.ts";

let home: string;
let path: string;

beforeEach(() => {
  // never the operator's home, never the login keychain: keys are in memory
  home = mkdtempSync(join(tmpdir(), "reviewflow-app-credentials-"));
  path = join(home, "nested", "credentials.json");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(home, { recursive: true, force: true });
});

const reviewflow = {
  url: "https://reviewflow.example.com",
  token: "secret-token-value",
  login: "me",
  accounts: ["me", "acme"],
  lastVerifiedAt: null,
};

const modeOf = (target: string): number => statSync(target).mode & 0o777;

const writeByHand = (contents: string): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

describe("encrypted file", () => {
  test("is empty before anything is stored", () => {
    expect(createFileCredentialStore(memoryKey(), path).read()).toEqual({
      version: 1,
    });
  });

  test("round trips and holds no token in clear, with 0600 on the file and 0700 on its directory", () => {
    const key = memoryKey();
    const store = createFileCredentialStore(key, path);
    store.write({ version: 1, reviewflow });
    const raw = readFileSync(path, "utf8");
    expect(raw).not.toContain(reviewflow.token);
    expect(JSON.parse(raw)).toMatchObject({ encrypted: "aes-256-gcm" });
    expect(store.read().reviewflow).toEqual(reviewflow);
    expect(modeOf(path)).toBe(0o600);
    expect(modeOf(join(home, "nested"))).toBe(0o700);
  });

  test("carries through a key it does not read", () => {
    const store = createFileCredentialStore(memoryKey(), path);
    store.write({ version: 1, reviewflow, other: { x: 1 } } as never);
    const { reviewflow: _dropped, ...rest } = store.read();
    store.write(rest);
    expect(store.read()).toMatchObject({ other: { x: 1 } });
  });

  test("encrypts a hand-written clear file on its first read", () => {
    writeByHand(JSON.stringify({ version: 1, reviewflow }));
    const store = createFileCredentialStore(memoryKey(), path);
    expect(store.read().reviewflow).toEqual(reviewflow);
    expect(readFileSync(path, "utf8")).not.toContain(reviewflow.token);
  });

  test("a missing key under an encrypted file is reported, never recreated", () => {
    createFileCredentialStore(memoryKey(), path).write({
      version: 1,
      reviewflow,
    });
    const before = readFileSync(path, "utf8");
    const lost = memoryKey();
    const store = createFileCredentialStore(lost, path);
    expect(() => store.read()).toThrow(/key is not in the keychain/);
    expect(() => {
      store.write({ version: 1 });
    }).toThrow(/key is not in the keychain/);
    expect(lost.created).toBe(0);
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  test("a wrong key is reported and the file is left as it was", () => {
    createFileCredentialStore(memoryKey(), path).write({
      version: 1,
      reviewflow,
    });
    const before = readFileSync(path, "utf8");
    const store = createFileCredentialStore(memoryKey(randomBytes(32)), path);
    let failure: unknown;
    try {
      store.read();
    } catch (error) {
      failure = error;
    }
    expect((failure as { code: string }).code).toBe(credentialsUnreadableCode);
    expect((failure as Error).message).not.toContain(reviewflow.token);
    expect(readFileSync(path, "utf8")).toBe(before);
  });
});

describe("unparseable file", () => {
  test.each([
    ["not json", "{ nope"],
    ["not an object", "[1]"],
  ])("is reported and never overwritten (%s)", (_name, contents) => {
    writeByHand(contents);
    const store = createFileCredentialStore(memoryKey(), path);
    expect(() => store.read()).toThrow();
    expect(readFileSync(path, "utf8")).toBe(contents);
  });
});
