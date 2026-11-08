export type PrState = "closed" | "draft" | "merged" | "open";
export type PrReviewDecision =
  | "approved"
  | "changesRequested"
  | "reviewRequired"
  | null;
/** `unknown` while GitHub has not computed it yet, which it does lazily */
export type PrMergeable = "conflicting" | "mergeable" | "unknown";
