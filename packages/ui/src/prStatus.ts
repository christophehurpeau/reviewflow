import type { PrStatus } from "@reviewflow/sdk";
import type { Accent } from "alouette";
import { usePullRequestSlots } from "./slots.tsx";

/** A merged pull request takes the brand accent; an app with its own accent for it passes one in the `prStatusAccents` slot. */
export const prStatusAccents: Record<PrStatus, Accent | undefined> = {
  approved: "success",
  changesRequested: "danger",
  closed: "danger",
  draft: undefined,
  merged: "brand",
  noReviewers: "warning",
  waitingReview: "info",
};

/** The badge accent of `status`: the app's (the `prStatusAccents` slot) over the ui's. */
export const usePrStatusAccent = (status: PrStatus): Accent | undefined => {
  const { prStatusAccents: appAccents = {} } = usePullRequestSlots();
  return status in appAccents ? appAccents[status] : prStatusAccents[status];
};
