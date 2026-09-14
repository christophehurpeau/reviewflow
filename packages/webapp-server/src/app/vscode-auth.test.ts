import { describe, expect, it } from "vitest";
import type { AuthInfo } from "../auth/authCookie.ts";
import { verifyAuthCookie, vscodeUserAgent } from "../auth/authCookie.ts";
import type { VscodeAuthState } from "./vscode-auth.ts";
import {
  buildVscodeAuthState,
  buildVscodeErrorRedirect,
  createVscodeRedirect,
  parseVscodeAuthState,
  redeemCode,
  renderEditorHandoffPage,
} from "./vscode-auth.ts";

const authInfo: AuthInfo = {
  id: 42,
  login: "someone",
  accessToken: "gh-token",
  time: 0,
};

const authState = (scheme = "vscode"): VscodeAuthState => ({
  client: "vscode",
  state: "nonce",
  scheme,
});

const codeOf = (redirect: string): string => {
  const code = new URL(redirect).searchParams.get("code");
  if (!code) throw new Error(`No code in ${redirect}`);
  return code;
};

describe("parseVscodeAuthState", () => {
  it("reads back the state it built", () => {
    expect(
      parseVscodeAuthState(buildVscodeAuthState("nonce", "vscode-insiders")),
    ).toEqual({ client: "vscode", state: "nonce", scheme: "vscode-insiders" });
  });

  it("falls back to vscode rather than carry a scheme it does not know", () => {
    expect(
      parseVscodeAuthState(buildVscodeAuthState("nonce", "javascript")),
    ).toMatchObject({ scheme: "vscode" });
  });

  it("ignores a state that is not the editor's", () => {
    expect(parseVscodeAuthState(undefined)).toBeUndefined();
    expect(parseVscodeAuthState("not json")).toBeUndefined();
    expect(
      parseVscodeAuthState(JSON.stringify({ orgId: 1, orgLogin: "org" })),
    ).toBeUndefined();
  });

  /** the scheme is the one thing taken from the request, so it is checked on the way back too */
  it("refuses a state carrying a scheme that is not an editor's", () => {
    expect(
      parseVscodeAuthState(
        JSON.stringify({
          client: "vscode",
          state: "nonce",
          scheme: "javascript",
        }),
      ),
    ).toBeUndefined();
  });
});

describe("createVscodeRedirect", () => {
  it("addresses the extension by its published id", async () => {
    const url = new URL(await createVscodeRedirect(authInfo, authState()));

    expect(url.protocol).toBe("vscode:");
    expect(url.host).toBe("christophehurpeau.reviewflow-vscode");
    expect(url.pathname).toBe("/auth");
  });

  it("answers on the editor build that asked", async () => {
    const url = new URL(
      await createVscodeRedirect(authInfo, authState("vscode-insiders")),
    );

    expect(url.protocol).toBe("vscode-insiders:");
    expect(url.host).toBe("christophehurpeau.reviewflow-vscode");
  });

  it("hands back a code and the editor's own nonce, never the token", async () => {
    const redirect = await createVscodeRedirect(authInfo, authState());
    const url = new URL(redirect);

    expect(url.searchParams.get("state")).toBe("nonce");
    expect(url.searchParams.get("code")).toBeTruthy();
    expect(redirect).not.toContain(authInfo.accessToken);
  });

  it("signs a token the websocket handshake accepts", async () => {
    const redirect = await createVscodeRedirect(authInfo, authState());
    const token = redeemCode(codeOf(redirect));

    await expect(
      verifyAuthCookie(token!, vscodeUserAgent),
    ).resolves.toMatchObject({ id: 42, login: "someone" });
  });

  it("burns the code after one use", async () => {
    const redirect = await createVscodeRedirect(authInfo, authState());
    const code = codeOf(redirect);

    expect(redeemCode(code)).toBeTruthy();
    expect(redeemCode(code)).toBeUndefined();
  });
});

describe("buildVscodeErrorRedirect", () => {
  it("reports the failure to the editor rather than to the webapp", () => {
    const url = new URL(buildVscodeErrorRedirect(authState(), "Access denied"));

    expect(url.protocol).toBe("vscode:");
    expect(url.searchParams.get("error")).toBe("Access denied");
    expect(url.searchParams.get("state")).toBe("nonce");
  });
});

describe("renderEditorHandoffPage", () => {
  it("offers the link as well as going there itself", () => {
    const page = renderEditorHandoffPage(
      "vscode://christophehurpeau.reviewflow-vscode/auth?code=c&state=n",
    );

    expect(page).toContain(
      'href="vscode://christophehurpeau.reviewflow-vscode/auth?code=c&amp;state=n"',
    );
    expect(page).toContain("location.replace(");
  });

  it("names the extension the editor routes by", () => {
    expect(
      renderEditorHandoffPage(
        "vscode://christophehurpeau.reviewflow-vscode/auth?code=c",
      ),
    ).toContain("christophehurpeau.reviewflow-vscode");
  });

  /** the nonce reaches this page from the request that started the sign in */
  it("escapes the url rather than let it close the attribute", () => {
    const page = renderEditorHandoffPage(
      'vscode://x/auth?state="><script>alert(1)</script>',
    );

    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).toContain("&quot;&gt;&lt;script&gt;");
  });
});
