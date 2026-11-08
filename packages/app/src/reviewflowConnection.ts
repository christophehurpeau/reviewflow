import { defaultCredentialStore } from "./credentials/defaultStore.ts";
import type {
  CredentialStore,
  StoredReviewflowCredentials,
} from "./credentials/store.ts";

/**
 * The one reviewflow `{ url, token }` of this machine, read from and written
 * to the credentials file. Every writer rewrites the whole file from `read()`,
 * so a key this build does not know about survives.
 */

const storeFor = (store?: CredentialStore): CredentialStore =>
  store ?? defaultCredentialStore();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The entry may have been written by hand: only `url` and `token` are required. */
export const readReviewflowConnection = (
  store?: CredentialStore,
): StoredReviewflowCredentials | null => {
  const stored: unknown = storeFor(store).read().reviewflow;
  if (
    !isRecord(stored) ||
    typeof stored.url !== "string" ||
    typeof stored.token !== "string" ||
    stored.url === "" ||
    stored.token === ""
  ) {
    return null;
  }
  return {
    url: stored.url.replace(/\/+$/u, ""),
    token: stored.token,
    login: typeof stored.login === "string" ? stored.login : null,
    accounts: Array.isArray(stored.accounts)
      ? stored.accounts.filter((a): a is string => typeof a === "string")
      : [],
    lastVerifiedAt:
      typeof stored.lastVerifiedAt === "string" ? stored.lastVerifiedAt : null,
  };
};

export const writeReviewflowConnection = (
  next: StoredReviewflowCredentials | null,
  store?: CredentialStore,
): void => {
  const target = storeFor(store);
  const { reviewflow: _previous, ...document } = target.read();
  target.write(next === null ? document : { ...document, reviewflow: next });
};

/**
 * The server is its origin: reviewflow serves the api at the root, and a url
 * copied from the tokens page carries a path that is not part of it.
 */
const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const normaliseReviewflowUrl = (url: string): string => {
  const parsed = ((): URL | null => {
    try {
      return new URL(url.trim());
    } catch {
      return null;
    }
  })();
  if (
    parsed === null ||
    (parsed.protocol !== "https:" && parsed.protocol !== "http:")
  ) {
    throw new Error(
      "the reviewflow url is the server's address, e.g. https://reviewflow.example.com",
    );
  }
  // the token goes along with every request: in clear text only to this machine
  if (parsed.protocol === "http:" && !loopbackHostnames.has(parsed.hostname)) {
    throw new Error(
      `the reviewflow url must be https: the token would travel in clear text to ${parsed.hostname}`,
    );
  }
  return parsed.origin;
};

/** A message safe to log or answer with: the token never survives it. */
export const withoutToken = (message: string, token: string): string =>
  token === "" ? message : message.split(token).join("[token]");
