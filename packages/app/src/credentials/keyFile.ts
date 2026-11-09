import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { env } from "node:process";
import { configHome } from "../config.ts";
import type { CredentialKey } from "./store.ts";
import { credentialKeyBytes } from "./store.ts";

/**
 * Where the credentials key lives outside macOS, which has no login keychain:
 * `$XDG_DATA_HOME/reviewflow-app` (default `~/.local/share`), away from the app
 * home, so a copied `~/.reviewflow-app` alone reveals nothing. A backup of the
 * whole home holds both: weaker than the keychain.
 *
 * Named after the app home, so a second `REVIEWFLOW_APP_HOME` never reads or
 * replaces the operator's key.
 */
export const credentialKeyPathOf = (home: string = configHome()): string => {
  const dataHome =
    env.XDG_DATA_HOME === undefined || env.XDG_DATA_HOME === ""
      ? join(homedir(), ".local", "share")
      : env.XDG_DATA_HOME;
  const name = createHash("sha256").update(home).digest("hex").slice(0, 16);
  return join(dataHome, "reviewflow-app", `${name}.key`);
};

const readKeyFile = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

/** A 0600 file in a 0700 directory, read once per process. */
export const createFileCredentialKey = (
  path: string = credentialKeyPathOf(),
): CredentialKey => {
  let cached: Buffer | null = null;
  return {
    read: () => {
      if (cached) return cached;
      const content = readKeyFile(path);
      if (content === null) return null;
      const key = Buffer.from(content.trim(), "base64");
      if (key.length !== credentialKeyBytes) {
        throw new Error(
          `${path} does not hold a ${String(credentialKeyBytes)}-byte key`,
        );
      }
      cached = key;
      return key;
    },
    create: () => {
      const key = randomBytes(credentialKeyBytes);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      // `wx`: never replace a key another process wrote meanwhile
      writeFileSync(path, `${key.toString("base64")}\n`, {
        mode: 0o600,
        flag: "wx",
      });
      cached = key;
      return key;
    },
  };
};
