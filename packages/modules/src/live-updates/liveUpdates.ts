export type LiveUpdatesStatus = "live" | "paused";

/** the server's limit on live subscriptions, or the one of each user */
export type LiveUpdatesPausedBy = "serverLimit" | "userLimit";

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
  return "liveUpdatesPausedBy" in meta &&
    meta.liveUpdatesPausedBy === "userLimit"
    ? "userLimit"
    : "serverLimit";
};
