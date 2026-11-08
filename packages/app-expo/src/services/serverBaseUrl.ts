import { Platform } from "react-native";

const defaultServer = "http://127.0.0.1:7450";

/**
 * Where the app server is. The exported app is served by the app server
 * itself, so it talks to its own origin, whatever the port; the expo dev
 * server (`__DEV__`) and a native build talk to
 * `EXPO_PUBLIC_REVIEWFLOW_APP_SERVER`, default `http://127.0.0.1:7450`.
 *
 * Decided by the build rather than the page's port: another dev server holding
 * a port moves expo to the next one, and that page would then call itself and
 * read the dev server's HTML as an answer.
 */
export const serverBaseUrl = (): string => {
  if (
    !__DEV__ &&
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location.protocol.startsWith("http")
  ) {
    return window.location.origin;
  }
  const configured = process.env.EXPO_PUBLIC_REVIEWFLOW_APP_SERVER;
  return configured === undefined || configured === ""
    ? defaultServer
    : configured.replace(/\/+$/, "");
};
