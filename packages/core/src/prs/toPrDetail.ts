import { Query } from "mingo";
import type {
  PrBucket,
  PrDetail,
  PrDetailChecks,
  PrReviewer,
  PrReviewerState,
  PrState,
} from "reviewflow-modules";
import { prBucketsInOrder } from "reviewflow-modules";
import type { AccountInfo } from "../models/AccountInfo.ts";
import type { ReviewerRequest } from "../models/ReviewerRequest.ts";
import type { ReviewerReview } from "../models/ReviewerReview.ts";
import type { ReviewflowPr } from "../mongo.ts";
import type { PrBucketContext } from "../prBucketCriteria.ts";
import { buildPrBucketQuery } from "../prBucketCriteria.ts";
import type { PrChecksAndStatuses } from "./toPrSummary.ts";
import {
  readPrChecksAndStatuses,
  toChecksSummary,
  toPrSummary,
} from "./toPrSummary.ts";

const toIso = (date: Date | undefined): string | null =>
  date ? date.toISOString() : null;

/** a document closed without `isMerged` predates it: unknown, not "closed" */
const toState = ({
  isClosed,
  isDraft,
  isMerged,
}: ReviewflowPr): PrState | null => {
  if (!isClosed) return isDraft ? "draft" : "open";
  if (isMerged === undefined) return null;
  return isMerged ? "merged" : "closed";
};

const passedCheckConclusions = new Set(["neutral", "skipped", "success"]);

const toDetailChecks = (
  checksAndStatuses: PrChecksAndStatuses,
): PrDetailChecks => {
  const { checksConclusionRecord, statusesConclusionRecord, result } =
    checksAndStatuses;
  const checks = Object.values(checksConclusionRecord);
  const statuses = Object.values(statusesConclusionRecord);

  return {
    ...toChecksSummary(checksAndStatuses),
    passed:
      checks.filter(
        ({ conclusion }) =>
          conclusion != null && passedCheckConclusions.has(conclusion),
      ).length + statuses.filter(({ state }) => state === "success").length,
    failed: result.failedChecks.length + result.failedStatuses.length,
    pending: result.pendingChecks.length + result.pendingStatuses.length,
  };
};

const toReviewers = ({ reviews, creator }: ReviewflowPr): PrReviewer[] => {
  const reviewedById = new Map<number, ReviewerReview>(
    reviews?.reviewed?.map((review) => [review.id, review]),
  );

  const toReviewer = (
    { id, login }: AccountInfo,
    state: PrReviewerState,
    requestedAt?: ReviewerRequest["requestedAt"],
  ): PrReviewer => ({
    id,
    login,
    state,
    submittedAt: toIso(reviewedById.get(id)?.submittedAt),
    requestedAt: toIso(requestedAt),
  });

  const reviewers = [
    ...(reviews?.reviewRequested ?? []).map((request) =>
      toReviewer(
        request,
        reviewedById.has(request.id) ? "reRequested" : "requested",
        request.requestedAt,
      ),
    ),
    ...(reviews?.approved ?? []).map((user) => toReviewer(user, "approved")),
    ...(reviews?.changesRequested ?? []).map((user) =>
      toReviewer(user, "changesRequested"),
    ),
    ...(reviews?.commented ?? []).map((user) => toReviewer(user, "commented")),
    ...(reviews?.dismissed ?? []).map((user) => toReviewer(user, "dismissed")),
  ];

  // replying in a review thread records the author as a reviewer
  return reviewers.filter(({ id }) => id !== creator?.id);
};

/**
 * Builds the converter for one reader: the bucket criteria depend on who asks,
 * so they are compiled once and evaluated on each document rather than
 * written a second time.
 */
export const createToPrDetail = (
  viewer: PrBucketContext,
): ((pr: ReviewflowPr) => PrDetail) => {
  const bucketQueries = prBucketsInOrder.map((bucket): [PrBucket, Query] => [
    bucket,
    new Query(
      buildPrBucketQuery(bucket, viewer).criteria as Record<string, unknown>,
    ),
  ]);

  return (pr) => {
    const {
      checks: summaryChecks,
      openedAt,
      approvedAt,
      ...summary
    } = toPrSummary(pr);

    return {
      ...summary,
      accountId: pr.account.id,
      repoId: pr.repo.id,
      ownerRepo: `${pr.account.login}/${pr.repo.name}`,
      githubNodeId: null,

      headRef: pr.headRef ?? null,
      baseRef: pr.baseRef ?? null,
      headSha: pr.headSha ?? null,
      headRepoFullName: pr.headRepoFullName ?? null,

      state: toState(pr),
      mergeable: "unknown",

      flowDates: {
        createdAt: toIso(pr.flowDates?.createdAt),
        openedAt: toIso(pr.flowDates?.openedAt),
        readyAt: toIso(pr.flowDates?.readyAt),
        reviewStartedAt: toIso(pr.flowDates?.reviewStartedAt),
        approvedAt: toIso(pr.flowDates?.approvedAt),
        closedAt: toIso(pr.flowDates?.closedAt),
        lastPushedAt: toIso(pr.flowDates?.lastPushedAt),
        lastReviewSubmittedAt: toIso(pr.flowDates?.lastReviewSubmittedAt),
      },

      reviewState: pr.reviewState ?? null,
      reviewers: toReviewers(pr),
      unresolvedThreads: null,

      checks: toDetailChecks(readPrChecksAndStatuses(pr)),

      myBuckets: bucketQueries
        .filter(([, query]) =>
          query.test(pr as unknown as Record<string, unknown>),
        )
        .map(([bucket]) => bucket),

      updatedAt: pr.updated.toISOString(),
    };
  };
};
