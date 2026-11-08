import type { PrStatus } from "@reviewflow/sdk";
import type { Accent } from "alouette";

/** A merged pull request takes the brand accent; an app with its own accent for it passes one instead. */
export const prStatusAccents: Record<PrStatus, Accent | undefined> = {
  approved: "success",
  changesRequested: "danger",
  closed: "danger",
  draft: undefined,
  merged: "brand",
  noReviewers: "warning",
  waitingReview: "info",
};
