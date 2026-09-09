import type { ServiceQuery } from "liwi-resources-client";
import type { PrBucket, PrSummary } from "./Pr.ts";

export interface QueryMyPrsParams {
  /** `null` spans the user's own account and every org they belong to. */
  accountId: number | null;
  bucket: PrBucket;
}

export interface StartReviewParams {
  prId: string;
}

export interface StartReviewResult {
  /**
   * Where the reviewer goes next. Returned rather than passed in, so a caller
   * holding only a pull request id — the slack home link — cannot decide where
   * the redirect lands.
   */
  prUrl: string;
}

export interface PrsService {
  queries: {
    queryMyPrs: ServiceQuery<PrSummary[], QueryMyPrsParams>;
  };
  operations: {
    startReview: (params: StartReviewParams) => Promise<StartReviewResult>;
  };
}
