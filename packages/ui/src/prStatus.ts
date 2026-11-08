import type {
  PrReviewDecision,
  PrState,
  ReviewflowBoardPr,
} from "@reviewflow/sdk";
import type { Accent } from "alouette";

/**
 * What a reader is told about a pull request in one word or two: an open pull
 * request is only interesting for where its review stands, so state and review
 * decision collapse into one status.
 */
export type PrStatus =
  | "approved"
  | "changesRequested"
  | "closed"
  | "draft"
  | "merged"
  | "noReviewers"
  | "waitingReview";

/** A closed or merged pull request keeps its own status whatever the last review said. */
export const prStatus = ({
  state,
  reviewDecision,
}: {
  state: PrState;
  reviewDecision: PrReviewDecision;
}): PrStatus => {
  if (state !== "open") return state;
  switch (reviewDecision) {
    case "approved": {
      return "approved";
    }
    case "changesRequested": {
      return "changesRequested";
    }
    case "reviewRequired": {
      return "waitingReview";
    }
    case null: {
      return "noReviewers";
    }
    default: {
      return reviewDecision satisfies never;
    }
  }
};

export const prStatusLabels: Record<PrStatus, string> = {
  approved: "approved",
  changesRequested: "changes requested",
  closed: "closed",
  draft: "draft",
  merged: "merged",
  noReviewers: "no reviewers",
  waitingReview: "waiting review",
};

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

const reviewflowReviewDecisions = {
  approved: "approved",
  changesRequested: "changesRequested",
  requested: "reviewRequired",
  none: null,
} as const;

/** null when reviewflow does not know enough to say */
export const reviewflowPrStatus = ({
  state,
  reviewState,
}: Pick<ReviewflowBoardPr, "reviewState" | "state">): PrStatus | null => {
  if (state === null) return null;
  if (state !== "open") return state;
  if (reviewState === null) return null;
  return prStatus({
    state,
    reviewDecision: reviewflowReviewDecisions[reviewState],
  });
};
