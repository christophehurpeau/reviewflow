/**
 * Which requests the server answers, judged from two headers.
 *
 * The server reads and writes GitHub as the user and no route authenticates,
 * so a web page the user visits must not be able to call it. Two attacks:
 *
 * - **A cross-origin request from a foreign page.** The `Origin` header names
 *   the page; anything that is not the server's own origin or the expo dev
 *   server is refused, and only an allowed origin is echoed back in
 *   `access-control-allow-origin`, so a browser never hands a foreign page the
 *   response either.
 * - **DNS rebinding.** A foreign domain re-resolved to 127.0.0.1 makes the
 *   server "same-origin" for the browser, so `Origin` proves nothing, but the
 *   `Host` header still carries the foreign name. It must be a loopback name.
 *
 * - **A plain GET from a foreign page** (`<img src>`, `<script src>`), which
 *   browsers send without `Origin`. The response is unreadable, but the route
 *   still runs: a fetch, a GitHub call. `Sec-Fetch-Site` names it cross-site;
 *   an api request so marked is refused. A page is still reachable from a
 *   link: only `/api/` is guarded this way.
 *
 * The Host check accepts any port, so an SSH tunnel to a different local port
 * keeps working. A request with no `Origin` and no `Sec-Fetch-Site` (curl, a
 * native build) is not a browser cross-origin call and passes.
 */

/**
 * The app's expo dev server, pinned by its `start` script: the reviewflow
 * webapp's own dev server already holds expo's default 8081.
 */
export const webappDevPort = 8085;

export type RequestVerdict =
  | { allowed: false; reason: string }
  | { allowed: true; corsOrigin: string | null };

const loopbackHostnames = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

const devOrigins = new Set([
  `http://127.0.0.1:${String(webappDevPort)}`,
  `http://localhost:${String(webappDevPort)}`,
]);

const hostnameOf = (host: string): string => {
  const lowered = host.toLowerCase();
  if (lowered.startsWith("[")) {
    const end = lowered.indexOf("]");
    return end === -1 ? lowered : lowered.slice(0, end + 1);
  }
  // more than one colon and no brackets: a bare IPv6 address, not host:port
  if (lowered.split(":").length > 2) return lowered;
  const colon = lowered.indexOf(":");
  return colon === -1 ? lowered : lowered.slice(0, colon);
};

const crossSiteFetches = new Set(["cross-site", "same-site"]);

export interface JudgedRequest {
  host?: string;
  origin?: string;
  secFetchSite?: string;
  /** an `/api/` route, which acts as the user */
  api: boolean;
  /** `REVIEWFLOW_APP_DEV`: the expo dev server's origins are trusted too */
  allowDevOrigins: boolean;
}

export const judgeRequest = ({
  host,
  origin,
  secFetchSite,
  api,
  allowDevOrigins,
}: JudgedRequest): RequestVerdict => {
  if (host !== undefined && !loopbackHostnames.has(hostnameOf(host))) {
    return { allowed: false, reason: `host ${host} is not loopback` };
  }

  if (origin === undefined) {
    if (
      api &&
      secFetchSite !== undefined &&
      crossSiteFetches.has(secFetchSite)
    ) {
      return { allowed: false, reason: `a ${secFetchSite} request` };
    }
    return { allowed: true, corsOrigin: null };
  }

  if (
    (host !== undefined && origin === `http://${host}`) ||
    (allowDevOrigins && devOrigins.has(origin))
  ) {
    return { allowed: true, corsOrigin: origin };
  }

  return { allowed: false, reason: `origin ${origin} is not allowed` };
};
