import type { AccountInfo } from "./AccountInfo.ts";
import type { ReviewerReview } from "./ReviewerReview.ts";
import type { TeamInfo } from "./TeamInfo.ts";

export interface ReviewersGroupedByState {
  teamReviewRequested: TeamInfo[];
  reviewRequested: AccountInfo[];
  approved: AccountInfo[];
  changesRequested: AccountInfo[];
  dismissed: AccountInfo[];
  commented: AccountInfo[];
  /**
   * Everyone who ever submitted a review, and when they last decided. The
   * groups above hold one state per person, so a review request replaces what
   * they had done before: this is what still tells a first review apart from a
   * review asked again. Absent on documents written before it existed.
   */
  reviewed?: ReviewerReview[];
}
