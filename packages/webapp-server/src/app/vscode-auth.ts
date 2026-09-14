import { randomUUID } from "node:crypto";
import type { Request, Response, Router } from "express";
import type { AuthInfo } from "../auth/authCookie.ts";
import { signAuthToken, vscodeUserAgent } from "../auth/authCookie.ts";

/**
 * `publisher.name` of the extension, which is what the editor routes a
 * `<scheme>://` url by. Fixed here rather than taken from the request: echoing
 * a caller supplied target would hand a reviewflow session to whoever asked for
 * it.
 */
const extensionId =
  process.env.VSCODE_EXTENSION_ID || "christophehurpeau.reviewflow-vscode";

/**
 * The editor supplies its own url scheme, because a build other than vscode
 * stable does not answer to `vscode://`. Only the scheme is taken from the
 * request, and only out of this list: the extension it addresses stays fixed.
 */
const allowedSchemes = new Set([
  "code-oss",
  "cursor",
  "positron",
  "trae",
  "vscode",
  "vscode-exploration",
  "vscode-insiders",
  "vscodium",
  "windsurf",
]);

export const isAllowedScheme = (scheme: unknown): scheme is string =>
  typeof scheme === "string" && allowedSchemes.has(scheme);

/** long enough for the editor to be brought back to the front, short enough to be worthless if leaked */
const codeTtlMs = 60_000;

interface PendingToken {
  token: string;
  expiresAt: number;
}

/**
 * The token is handed over through a single use code redeemed over https,
 * never in the editor url itself: that url passes through the browser's address
 * bar and history, and the token carries the user's github access token.
 *
 * In memory on purpose, as the resources subscriptions already require this to
 * be one process.
 */
const pendingTokens = new Map<string, PendingToken>();

const dropExpiredTokens = (now: number): void => {
  for (const [code, pending] of pendingTokens) {
    if (pending.expiresAt <= now) pendingTokens.delete(code);
  }
};

export interface VscodeAuthState {
  client: "vscode";
  state: string;
  scheme: string;
}

export const isVscodeAuthState = (state: unknown): state is VscodeAuthState =>
  typeof state === "object" &&
  state !== null &&
  (state as VscodeAuthState).client === "vscode" &&
  typeof (state as VscodeAuthState).state === "string" &&
  isAllowedScheme((state as VscodeAuthState).scheme);

/**
 * The editor's own nonce, handed back untouched so it can tell the response
 * apart from one a hostile page triggered to sign the user into another
 * account.
 */
export const parseVscodeAuthState = (
  rawState: unknown,
): VscodeAuthState | undefined => {
  if (typeof rawState !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(rawState);
    return isVscodeAuthState(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const buildVscodeAuthState = (state: string, scheme: string): string =>
  JSON.stringify({
    client: "vscode",
    state,
    scheme: isAllowedScheme(scheme) ? scheme : "vscode",
  } satisfies VscodeAuthState);

const buildEditorUrl = (
  { scheme, state }: VscodeAuthState,
  params: Record<string, string>,
): string => {
  const url = new URL(`${scheme}://${extensionId}/auth`);
  url.searchParams.set("state", state);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

export const createVscodeRedirect = async (
  authInfo: AuthInfo,
  authState: VscodeAuthState,
): Promise<string> => {
  const now = Date.now();
  dropExpiredTokens(now);

  const token = await signAuthToken(authInfo, vscodeUserAgent);
  const code = randomUUID();
  pendingTokens.set(code, { token, expiresAt: now + codeTtlMs });

  return buildEditorUrl(authState, { code });
};

export const buildVscodeErrorRedirect = (
  authState: VscodeAuthState,
  error: string,
): string => buildEditorUrl(authState, { error });

const escapeHtml = (value: string): string =>
  value.replaceAll(
    /["&'<>]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );

/**
 * A 302 straight to `<scheme>://` is dropped without a word by browsers that
 * refuse to hand a redirect to an external protocol, which leaves the editor
 * waiting on a sign in that never lands. A page that asks instead always
 * arrives, and carries the link the user can press when the automatic attempt
 * is blocked.
 */
export const renderEditorHandoffPage = (editorUrl: string): string => {
  const href = escapeHtml(editorUrl);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signing in to reviewflow</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh;
         display: grid; place-items: center; background: #f6f8fa; color: #1f2328; }
  main { text-align: center; padding: 2rem; }
  a.button { display: inline-block; margin-top: 1rem; padding: .6rem 1.2rem;
             background: #1f883d; color: #fff; border-radius: 6px;
             text-decoration: none; font-weight: 600; }
  p { color: #59636e; }
</style>
</head>
<body>
<main>
  <h1>Opening your editor…</h1>
  <p>You can close this tab once the editor is back in front.</p>
  <a class="button" id="open-editor" href="${href}">Open the editor</a>
</main>
<!--
  the url is interpolated once, into an attribute that escapes it. Interpolating
  it into the script as well would need escaping of its own, since a "</script>"
  inside a javascript string still closes the tag.
-->
<script>location.replace(document.getElementById("open-editor").href);</script>
</body>
</html>`;
};

/** single use: a code that reached anyone else is worthless once the editor has it */
export const redeemCode = (code: unknown): string | undefined => {
  if (typeof code !== "string") return undefined;

  const now = Date.now();
  dropExpiredTokens(now);

  const pending = pendingTokens.get(code);
  if (!pending) return undefined;
  pendingTokens.delete(code);
  return pending.token;
};

export default function vscodeAuth(router: Router): void {
  router.post("/vscode/token", (req: Request, res: Response): void => {
    const token = redeemCode(req.query.code);
    if (!token) {
      res.status(400).json({ error: "Unknown or expired code" });
      return;
    }
    res.json({ token });
  });
}
