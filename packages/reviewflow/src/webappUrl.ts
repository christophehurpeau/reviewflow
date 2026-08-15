/** Base url of the webapp, linked from slack messages and pull request bodies. */
const baseUrl = (): string =>
  (process.env.REVIEWFLOW_APP_URL || "").replace(/\/+$/, "");

/**
 * The url used to end with the `/app` base path the screens were served under,
 * which now holds the oauth routes only: left there, every link written to a
 * pull request or to slack would point at a redirect instead of the webapp.
 */
export const checkWebappUrlConfig = (): void => {
  if (!process.env.REVIEWFLOW_APP_URL) {
    throw new Error("Missing env variable: REVIEWFLOW_APP_URL");
  }
  if (new URL(baseUrl()).pathname !== "/") {
    throw new Error(
      `Invalid env variable REVIEWFLOW_APP_URL: the webapp is served at the root, "${baseUrl()}" has a path`,
    );
  }
};

export const webappUrl = (path: string): string => `${baseUrl()}${path}`;

export const orgSettingsUrl = (orgLogin: string): string =>
  webappUrl(`/org/${encodeURIComponent(orgLogin)}`);
