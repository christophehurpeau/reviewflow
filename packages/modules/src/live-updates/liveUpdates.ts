export type LiveUpdatesStatus = "live" | "paused";

/**
 * `serverLimit` and `userLimit`: the server's limit on live subscriptions, or
 * the one of each user. `notEnabled`: live updates are a paid feature the
 * admin has not enabled for the account(s) the subscription reads.
 */
export type LiveUpdatesPausedBy = "notEnabled" | "serverLimit" | "userLimit";

/**
 * Carried in the `meta` of the `initial` change of a subscription: `paused`
 * when the server refused the live subscription and sent a single fetch.
 */
export interface LiveUpdatesMeta {
  liveUpdates: LiveUpdatesStatus;
  liveUpdatesPausedBy?: LiveUpdatesPausedBy;
}

export const isLiveUpdatesPaused = (meta: object | undefined): boolean =>
  !!meta && "liveUpdates" in meta && meta.liveUpdates === "paused";

export const getLiveUpdatesPausedBy = (
  meta: object | undefined,
): LiveUpdatesPausedBy | undefined => {
  if (!meta || !isLiveUpdatesPaused(meta)) return undefined;
  if (!("liveUpdatesPausedBy" in meta)) return "serverLimit";
  if (meta.liveUpdatesPausedBy === "userLimit") return "userLimit";
  if (meta.liveUpdatesPausedBy === "notEnabled") return "notEnabled";
  return "serverLimit";
};
