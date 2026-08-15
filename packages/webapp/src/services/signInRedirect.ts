/**
 * A signed out visitor following a link — the settings link in a slack message,
 * a pull request body, a bookmark — is shown the landing page, and the github
 * oauth flow always ends back on the root: the path asked for is kept aside for
 * the roundtrip, which stays within the browser tab that started it.
 */
const storageKey = "reviewflow:sign-in-redirect";

const isInternalPath = (path: string): boolean =>
  path.startsWith("/") && !path.startsWith("//") && path !== "/";

/* eslint-disable n/no-unsupported-features/node-builtins -- the browser session storage, not the experimental node one */

/** Absent on native, and a browser may deny access to it. */
const getSessionStorage = (): Storage | undefined => {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
};

/* eslint-enable n/no-unsupported-features/node-builtins */

/** Read while rendering, before anything navigates away from it. */
export const currentPath = (): string | undefined => {
  const { pathname, search } = globalThis.location ?? {};
  if (pathname === undefined) return undefined;

  const path = `${pathname}${search ?? ""}`;
  return isInternalPath(path) ? path : undefined;
};

export const rememberSignInRedirect = (path: string | undefined): void => {
  if (path) getSessionStorage()?.setItem(storageKey, path);
};

export const takeSignInRedirect = (): string | undefined => {
  const sessionStorage = getSessionStorage();
  const path = sessionStorage?.getItem(storageKey);
  sessionStorage?.removeItem(storageKey);
  return path && isInternalPath(path) ? path : undefined;
};
