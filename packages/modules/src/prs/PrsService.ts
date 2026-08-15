import type { ServiceQuery } from "liwi-resources-client";
import type { PrBucket, PrSummary } from "./Pr.ts";

export interface QueryMyPrsParams {
  /** `null` spans every org the user belongs to. */
  orgId: number | null;
  bucket: PrBucket;
}

export interface PrsService {
  queries: {
    queryMyPrs: ServiceQuery<PrSummary[], QueryMyPrsParams>;
  };
  operations: Record<string, never>;
}
