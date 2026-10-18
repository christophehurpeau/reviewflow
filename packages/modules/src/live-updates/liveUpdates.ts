export type LiveUpdatesStatus = "live" | "paused";

/**
 * Carried in the `meta` of the `initial` change of a subscription: `paused`
 * when the server refused the live subscription and sent a single fetch.
 */
export interface LiveUpdatesMeta {
  liveUpdates: LiveUpdatesStatus;
}

export const isLiveUpdatesPaused = (meta: object | undefined): boolean =>
  !!meta && "liveUpdates" in meta && meta.liveUpdates === "paused";
