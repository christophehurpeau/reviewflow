import type http from "node:http";
import * as cookie from "cookie";
import type { AuthenticatedUser } from "reviewflow-modules";
import type { AuthInfo } from "../auth/authCookie.ts";
import { authCookieName, verifyAuthCookie } from "../auth/authCookie.ts";
import { webappHost } from "../webappUrl.ts";

/**
 * The websocket handshake is a subresource request: a `SameSite=lax` cookie is
 * not sent cross-site, but the origin is checked as well so a regression in
 * that policy cannot silently open the socket to another site.
 */
const isAllowedOrigin = (origin: string | undefined, host: string): boolean => {
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    return originHost === host || originHost === webappHost;
  } catch {
    return false;
  }
};

export interface AuthenticatedWsUser extends AuthenticatedUser {
  accessToken: AuthInfo["accessToken"];
}

export const getAuthenticatedUser = async (
  request: http.IncomingMessage,
): Promise<AuthenticatedWsUser | null> => {
  const { host, origin, cookie: cookieHeader } = request.headers;
  if (!host || !isAllowedOrigin(origin, host)) return null;
  if (!cookieHeader) return null;

  const token = cookie.parse(cookieHeader)[authCookieName];
  if (!token) return null;

  const authInfo = await verifyAuthCookie(token, request.headers["user-agent"]);
  if (!authInfo) return null;

  return {
    id: authInfo.id,
    login: authInfo.login,
    accessToken: authInfo.accessToken,
  };
};
