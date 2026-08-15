import { promisify } from "node:util";
import jsonwebtoken from "jsonwebtoken";

if (!process.env.AUTH_SECRET_KEY) {
  throw new Error("Missing env variable: AUTH_SECRET_KEY");
}

const authSecretKey: string = process.env.AUTH_SECRET_KEY;

const signPromisified: any = promisify(jsonwebtoken.sign);
const verifyPromisified: any = promisify(jsonwebtoken.verify);

export const authCookieName = "auth_gh";

export const secureCookie =
  !!process.env.SECURE_COOKIE && process.env.SECURE_COOKIE !== "false";

export interface AuthInfo {
  id: number;
  login: string;
  accessToken: string;
  time: number;
}

/**
 * The cookie is pinned to the user agent, but `jsonwebtoken` skips the audience
 * check when the option is falsy: without a placeholder, a stolen cookie
 * replayed with no user agent header would bypass the pinning entirely.
 */
const audienceFor = (userAgent: string | undefined): string =>
  userAgent || "reviewflow:no-user-agent";

export const signAuthCookie = (
  authInfo: AuthInfo,
  userAgent: string | undefined,
): Promise<string> =>
  signPromisified(authInfo, authSecretKey, {
    algorithm: "HS512",
    audience: audienceFor(userAgent),
    expiresIn: "10 days",
  });

export const verifyAuthCookie = async (
  token: string,
  userAgent: string | undefined,
): Promise<AuthInfo | undefined> => {
  try {
    const authInfo: AuthInfo = await verifyPromisified(token, authSecretKey, {
      algorithm: "HS512",
      audience: audienceFor(userAgent),
    });
    return authInfo.id ? authInfo : undefined;
  } catch {
    return undefined;
  }
};
