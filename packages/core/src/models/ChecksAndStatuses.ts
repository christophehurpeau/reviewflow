import type { RestEndpointMethodTypes } from "@octokit/rest";

export interface ChecksAndStatuses {
  checksConclusionRecord: Record<
    string,
    Pick<
      RestEndpointMethodTypes["checks"]["listForRef"]["response"]["data"]["check_runs"][number],
      "conclusion" | "name"
    >
  >;
  statusesConclusionRecord: Record<
    string,
    Pick<
      RestEndpointMethodTypes["repos"]["getCombinedStatusForRef"]["response"]["data"]["statuses"][number],
      "context" | "state"
    >
  >;
}
