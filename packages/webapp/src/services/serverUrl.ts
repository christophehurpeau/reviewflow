/**
 * The oauth routes are served by the reviewflow server, which in production is
 * the same origin that serves this app and in development another port.
 */
const serverBaseUrl = (process.env.EXPO_PUBLIC_SERVER_URL ?? "").replace(
  /\/+$/,
  "",
);

export const serverUrl = (path: string): string => `${serverBaseUrl}${path}`;

export const websocketUrl = (): string => {
  if (process.env.EXPO_PUBLIC_WS_URL) return process.env.EXPO_PUBLIC_WS_URL;
  const { protocol, host } = globalThis.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
};

export const goToLogin = (): void => {
  globalThis.location.href = serverUrl("/app/login");
};
