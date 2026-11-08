import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { credentialsPath } from "../config.ts";
import { errorMessage, log } from "../log.ts";

/**
 * The app's secrets, in one 0600 file in a 0700 home. The token is the only
 * secret: it is written once, never returned by a route and never logged.
 *
 * Given a key, the file is AES-256-GCM encrypted (`keychain.ts` says what that
 * protects against and what it does not). A file found in clear — written by
 * hand, or before a key existed — is read as is and encrypted on the spot.
 */

/**
 * Bumped when the shape changes. A document from a *newer* build is left alone
 * rather than coerced: the fields this build does not know about are still
 * someone's working credentials.
 */
export const credentialsVersion = 1;

export interface StoredReviewflowCredentials {
  /** the reviewflow server that issued the token, without a trailing slash */
  url: string;
  token: string;
  /** what `GET /api/me/v1` answered at the last verification */
  login: string | null;
  accounts: string[];
  lastVerifiedAt: string | null;
}

export interface StoredCredentials {
  version: number;
  reviewflow?: StoredReviewflowCredentials;
}

export interface CredentialStore {
  read: () => StoredCredentials;
  write: (next: StoredCredentials) => void;
}

export interface CredentialKey {
  /** null when no key was ever created */
  read: () => Buffer | null;
  create: () => Buffer;
}

export const credentialKeyBytes = 32;
const cipherName = "aes-256-gcm";
const ivBytes = 12;

interface EncryptedDocument {
  encrypted: typeof cipherName;
  iv: string;
  tag: string;
  data: string;
}

const empty = (): StoredCredentials => ({ version: credentialsVersion });

export const credentialsUnreadableCode = "ERR_CREDENTIALS_UNREADABLE";

const unreadable = (message: string): Error =>
  Object.assign(new Error(message), { code: credentialsUnreadableCode });

/**
 * A file that does not parse is *reported*, never replaced. Same rule as
 * `~/.claude/settings.json`: overwriting it would silently discard credentials
 * the operator still has no copy of, and "it stopped working" is a better
 * failure than "it works and everything is disconnected".
 */
const parseObject = (path: string, contents: string): object => {
  const document = ((): unknown => {
    try {
      return JSON.parse(contents);
    } catch {
      throw unreadable(`${path} is not valid json — fix or remove it by hand`);
    }
  })();

  if (
    typeof document !== "object" ||
    document === null ||
    Array.isArray(document)
  ) {
    throw unreadable(`${path} does not hold a json object`);
  }
  return document;
};

const toStoredCredentials = (document: object): StoredCredentials => {
  // The rest of the document is carried through: a key this build does not
  // read is still a credential, and every writer rewrites the whole file from
  // what `read` returned.
  const { version, ...rest } = document as Partial<StoredCredentials>;
  return {
    ...rest,
    version: typeof version === "number" ? version : credentialsVersion,
  };
};

const isEncrypted = (document: object): document is EncryptedDocument =>
  (document as Partial<EncryptedDocument>).encrypted === cipherName;

const encrypt = (
  credentials: StoredCredentials,
  key: Buffer,
): EncryptedDocument => {
  const iv = randomBytes(ivBytes);
  const cipher = createCipheriv(cipherName, key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  return {
    encrypted: cipherName,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
};

const decrypt = (
  path: string,
  document: EncryptedDocument,
  key: Buffer,
): string => {
  try {
    const decipher = createDecipheriv(
      cipherName,
      key,
      Buffer.from(document.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(document.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(document.data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw unreadable(
      `${path} does not decrypt with the key in the keychain — restore the matching key or remove the file by hand`,
    );
  }
};

const readContents = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    // Absent is the normal state before anything is configured; anything
    // else — a permission problem, a directory where the file should be —
    // is a real fault and must not read as "nothing configured".
    if ((error as { code?: string }).code === "ENOENT") return null;
    throw error;
  }
};

const writeDocument = (path: string, document: object): void => {
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);

  // Written beside the target and renamed over it: `rename` is atomic within
  // a filesystem, so a crash mid-write leaves the previous credentials rather
  // than a truncated file that then fails to parse — which the rule above
  // would turn into a hard error the operator has to fix by hand.
  const temporary = join(directory, `.credentials.${String(process.pid)}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, {
    mode: 0o600,
  });
  // The mode argument only applies when the file is created, and a leftover
  // temp file from a previous crash may already exist with another mode.
  chmodSync(temporary, 0o600);
  renameSync(temporary, path);
};

/**
 * A missing key is only created when nothing on disk needs the old one:
 * replacing it under an encrypted file would leave that file undecryptable for
 * good.
 */
const keyFor = (path: string, key: CredentialKey): Buffer => {
  const existing = key.read();
  if (existing) return existing;
  const contents = readContents(path);
  if (contents !== null && isEncrypted(parseObject(path, contents))) {
    throw unreadable(
      `${path} is encrypted but its key is not in the keychain — restore the key or remove the file by hand`,
    );
  }
  return key.create();
};

/**
 * Always written encrypted. A clear file, only ever written by hand, is read
 * and encrypted in place.
 */
export const createFileCredentialStore = (
  key: CredentialKey,
  path: string = credentialsPath(),
): CredentialStore => ({
  read: () => {
    const contents = readContents(path);
    if (contents === null) return empty();
    const document = parseObject(path, contents);

    if (!isEncrypted(document)) {
      const credentials = toStoredCredentials(document);
      // A failure here leaves the file as it was and must not fail the read:
      // the credentials were readable a moment ago and still are.
      try {
        writeDocument(path, encrypt(credentials, keyFor(path, key)));
      } catch (error) {
        log("warn", "could not encrypt the credentials file", {
          path,
          error: errorMessage(error),
        });
      }
      return credentials;
    }

    return toStoredCredentials(
      parseObject(path, decrypt(path, document, keyFor(path, key))),
    );
  },

  write: (next) => {
    writeDocument(path, encrypt(next, keyFor(path, key)));
  },
});
