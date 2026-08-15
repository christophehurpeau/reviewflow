/**
 * Base url of the single page app. In production it is served by this same
 * express server, in development it is the expo dev server on another port.
 */
const baseUrl = (
  process.env.REVIEWFLOW_APP_URL || "http://localhost:8081"
).replace(/\/+$/, "");

// it used to end with the `/app` base path the screens were served under, which
// now holds the oauth routes: left there, the redirects to the webapp would loop
if (new URL(baseUrl).pathname !== "/") {
  throw new Error(
    `Invalid env variable REVIEWFLOW_APP_URL: the webapp is served at the root, "${baseUrl}" has a path`,
  );
}

export const webappHost = new URL(baseUrl).host;

export const webappUrl = (
  path: string,
  query?: Record<string, string>,
): string => {
  const search = query ? new URLSearchParams(query).toString() : "";
  return `${baseUrl}${path}${search ? `?${search}` : ""}`;
};
