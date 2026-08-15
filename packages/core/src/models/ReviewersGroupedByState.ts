import type { AccountInfo } from "./AccountInfo.ts";
import type { TeamInfo } from "./TeamInfo.ts";

export interface ReviewersGroupedByState {
  teamReviewRequested: TeamInfo[];
  reviewRequested: AccountInfo[];
  approved: AccountInfo[];
  changesRequested: AccountInfo[];
  dismissed: AccountInfo[];
  commented: AccountInfo[];
}
