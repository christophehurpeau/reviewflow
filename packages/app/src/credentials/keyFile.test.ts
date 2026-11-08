/* oxlint-disable eslint/no-bitwise */
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFileCredentialKey, credentialKeyPathOf } from "./keyFile.ts";

let directory: string;
let path: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "reviewflow-app-key-"));
  path = join(directory, "nested", "home.key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

const modeOf = (target: string): number => statSync(target).mode & 0o777;

describe("createFileCredentialKey", () => {
  test("reads no key before one is created", () => {
    expect(createFileCredentialKey(path).read()).toBeNull();
  });

  test("creates a 32-byte key in a 0600 file inside a 0700 directory", () => {
    const key = createFileCredentialKey(path).create();
    expect(key).toHaveLength(32);
    expect(modeOf(path)).toBe(0o600);
    expect(modeOf(dirname(path))).toBe(0o700);
  });

  test("a new instance reads back the created key", () => {
    const key = createFileCredentialKey(path).create();
    expect(createFileCredentialKey(path).read()).toEqual(key);
  });

  test("never replaces an existing key", () => {
    createFileCredentialKey(path).create();
    expect(() => createFileCredentialKey(path).create()).toThrow(/EEXIST/);
  });

  test("refuses a file that does not hold a 32-byte key", () => {
    writeFileSync(path.replace("nested/", ""), "c2hvcnQ=\n");
    expect(() =>
      createFileCredentialKey(path.replace("nested/", "")).read(),
    ).toThrow(/does not hold a 32-byte key/);
  });
});

describe("credentialKeyPathOf", () => {
  test("lives under XDG_DATA_HOME, one file per app home", () => {
    vi.stubEnv("XDG_DATA_HOME", directory);
    const operator = credentialKeyPathOf("/home/me/.reviewflow-app");
    const other = credentialKeyPathOf("/tmp/other-home");
    expect(dirname(operator)).toBe(join(directory, "reviewflow-app"));
    expect(operator).not.toBe(other);
  });

  test("defaults to ~/.local/share", () => {
    vi.stubEnv("XDG_DATA_HOME", "");
    expect(credentialKeyPathOf("/home/me/.reviewflow-app")).toContain(
      join(".local", "share", "reviewflow-app"),
    );
  });
});
