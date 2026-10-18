import type { RestEndpointMethodTypes } from "@octokit/rest";

type CheckRun =
  RestEndpointMethodTypes["checks"]["listForRef"]["response"]["data"]["check_runs"][number];
type CommitStatus =
  RestEndpointMethodTypes["repos"]["getCombinedStatusForRef"]["response"]["data"]["statuses"][number];

/** `status`, `title` and `details_url` are absent on records stored before them */
export interface StoredCheckRun extends Pick<CheckRun, "conclusion" | "name"> {
  status?: CheckRun["status"];
  /** `output.title` */
  title?: string | null;
  details_url?: string | null;
}

/** `description` and `target_url` are absent on records stored before them */
export interface StoredCommitStatus extends Pick<
  CommitStatus,
  "context" | "state"
> {
  description?: string | null;
  target_url?: string | null;
}

export interface ChecksAndStatuses {
  checksConclusionRecord: Record<string, StoredCheckRun>;
  statusesConclusionRecord: Record<string, StoredCommitStatus>;
}
