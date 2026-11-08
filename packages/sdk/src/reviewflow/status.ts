/**
 * How a client of the reviewflow API stands: whether a token is held, whose it
 * is, and whether the live stream is followed. Carries no token material by
 * construction, so it can be sent to a page and logged.
 */
export interface ReviewflowConnectionStatus {
  configured: boolean;
  /** the reviewflow server, e.g. `https://reviewflow.example.com` */
  url: string | null;
  /** the GitHub login the token belongs to, as of the last verification */
  login: string | null;
  /** the accounts the token reads, as of the last verification */
  accounts: string[];
  stream: "connecting" | "error" | "live" | "off";
  /** why the credentials are unreadable or the stream failed; never the token */
  error: string | null;
}
