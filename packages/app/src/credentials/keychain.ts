import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { configHome } from "../config.ts";
import type { CredentialKey } from "./store.ts";
import { credentialKeyBytes } from "./store.ts";

/**
 * The key that encrypts `credentials.json`, kept in the login keychain the way
 * Chromium's `safeStorage` keeps its own: the file alone — in a Time Machine
 * backup, a copied `~/.reviewflow-app`, a `cat` during a screen share — reveals nothing.
 *
 * It does not protect against a process running as the operator. The item is
 * written by `/usr/bin/security`, which its ACL then trusts, so anything can read
 * it back with `security find-generic-password -w` without a prompt; and the
 * app's own sources are writable by that same user.
 *
 * The keychain holds the key rather than the document because `security -i` —
 * the only way to hand it a secret without putting it in argv, where `ps` shows
 * it — silently drops a line past about 2KB and exits 0 whatever happened. Every
 * write is therefore read back.
 *
 * The account is the app home, so a second `REVIEWFLOW_APP_HOME` never reads
 * or replaces the operator's key.
 */

const securityPath = "/usr/bin/security";
const itemNotFoundStatus = 44;
const timeoutMs = 10_000;
const service = "com.christophehurpeau.reviewflow-app.credentials-key";

const runSecurity = (
  args: string[],
  input?: string,
): { status: number | null; stdout: string; stderr: string } => {
  const result = spawnSync(securityPath, args, {
    encoding: "utf8",
    input,
    timeout: timeoutMs,
  });
  if (result.error) throw result.error;
  return result;
};

const findSecret = (account: string): string | null => {
  const { status, stdout, stderr } = runSecurity([
    "find-generic-password",
    "-s",
    service,
    "-a",
    account,
    "-w",
  ]);
  if (status === itemNotFoundStatus) return null;
  if (status !== 0) {
    throw new Error(
      `the keychain refused to read the credentials key: ${stderr.trim()}`,
    );
  }
  return stdout.trim();
};

const addSecret = (account: string, secret: string): void => {
  // `security -i` splits its line on whitespace and honours double quotes,
  // with no escape for one inside them.
  if (/["\\\n]/.test(account)) {
    throw new Error(
      `cannot store a credentials key for ${account}: it holds a quote, a backslash or a newline`,
    );
  }
  runSecurity(
    ["-i"],
    `add-generic-password -U -s "${service}" -a "${account}" -w ${secret}\n`,
  );
  if (findSecret(account) !== secret) {
    throw new Error("the keychain did not store the credentials key");
  }
};

/**
 * Read once per process: a `security` spawn costs tens of milliseconds and the
 * file is read on every refresh. A failed read is not remembered, so a locked
 * keychain recovers on the next call.
 */
export const createKeychainCredentialKey = (
  account: string = configHome(),
): CredentialKey => {
  let cached: Buffer | null = null;
  return {
    read: () => {
      if (cached) return cached;
      const secret = findSecret(account);
      if (secret === null) return null;
      const key = Buffer.from(secret, "base64");
      if (key.length !== credentialKeyBytes) {
        throw new Error(
          `the keychain item ${service} for ${account} does not hold a ${String(credentialKeyBytes)}-byte key`,
        );
      }
      cached = key;
      return key;
    },
    create: () => {
      const key = randomBytes(credentialKeyBytes);
      addSecret(account, key.toString("base64"));
      cached = key;
      return key;
    },
  };
};

/** false when there was no item to delete */
export const deleteKeychainCredentialKey = (
  account: string = configHome(),
): boolean => {
  const { status, stderr } = runSecurity([
    "delete-generic-password",
    "-s",
    service,
    "-a",
    account,
  ]);
  if (status === itemNotFoundStatus) return false;
  if (status !== 0) {
    throw new Error(
      `the keychain refused to delete the credentials key: ${stderr.trim()}`,
    );
  }
  return true;
};
