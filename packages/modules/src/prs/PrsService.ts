import type { ServiceQuery } from "liwi-resources-client";
import type { PrBucket, PrSummary } from "./Pr.ts";

export interface QueryMyPrsParams {
  /** `null` spans the user's own account and every org they belong to. */
  accountId: number | null;
  bucket: PrBucket;
}

export interface PrsService {
  queries: {
    queryMyPrs: ServiceQuery<PrSummary[], QueryMyPrsParams>;
  };
  operations: Record<string, never>;
}
