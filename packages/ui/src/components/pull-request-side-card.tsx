import type {
  PullRequestCandidatesResponse,
  PullRequestChecksResponse,
  PullRequestSummary,
} from "@reviewflow/sdk";
import { reviewflowPrStatus } from "@reviewflow/sdk";
import { View, WarningMessage } from "alouette";
import type { ReactNode } from "react";
import type { PullRequestReadState } from "../dataSource.ts";
import { PullRequestReadyForReview } from "./pull-request-actions-draft.tsx";
import {
  PullRequestMergeButton,
  PullRequestMergeStatus,
} from "./pull-request-actions-merge.tsx";
import type { PullRequestActionProps } from "./pull-request-actions-review.tsx";
import { PullRequestChecksSummary } from "./pull-request-checks.tsx";
import { ReadOnlySection } from "./pull-request-read-only-section.tsx";
import { Reviewers } from "./pull-request-reviewers.tsx";
import { MergeLine } from "./pull-request-status-line.tsx";

export interface PullRequestSideCardProps extends PullRequestActionProps {
  /**
   * The `checks` part as read. A `PullRequestReadState` from the data source's
   * `usePart` fits as is; only `value` (null until the first answer) and
   * `error` (why the last read failed) are used.
   */
  checks: Pick<
    PullRequestReadState<PullRequestChecksResponse>,
    "error" | "value"
  >;
  /**
   * reviewflow's copy, where the review status comes from, as in the screen's
   * header. Absent or null: an open pull request shows no review status.
   */
  summary?: PullRequestSummary | null;
  /**
   * What the reviewer editor offers. Absent or null: the reviewers are listed
   * and re-requested, but none can be asked anew.
   */
  candidates?: PullRequestCandidatesResponse | null;
}

/**
 * One pull request at a glance, for a host's side column rather than a page:
 * its status and branches, the move it waits on (ready for review on a draft,
 * merge and update branch when open), the checks still failing or running, and
 * the reviewers with request and re-request. The pieces are the screen's own,
 * so it reads and behaves as the screen does.
 *
 * Built from props alone: no `PullRequestScreen` around it, and no provider of
 * this package. `PullRequestSlotsProvider` is read when present (the status
 * badge's accent). Every press is one `PullRequestEdit` through `onEdit`,
 * which writes it and reads the pull request again before resolving, the
 * contract of the screen's own action buttons; a rejection is shown beside
 * the press that caused it.
 *
 * A fluid column, from a narrow side panel to half a wide frame: it draws no
 * surface and scrolls nothing, the host's container is its ground and owns the
 * scrolling.
 */
export function PullRequestSideCard({
  detail,
  checks,
  summary = null,
  candidates = null,
  onEdit,
}: PullRequestSideCardProps): ReactNode {
  const { pullRequest, errors } = detail;
  return (
    <View className="min-w-0 gap-xl">
      {[...new Set([...errors, ...(candidates?.errors ?? [])])].map((error) => (
        <WarningMessage key={error}>{error}</WarningMessage>
      ))}
      <View className="gap-sm">
        <MergeLine
          status={reviewflowPrStatus({
            state: pullRequest.state,
            reviewState: summary?.reviewState ?? null,
          })}
          author={pullRequest.author?.login ?? null}
          baseRef={pullRequest.baseRef}
          headRef={pullRequest.headRef}
        />
        <PullRequestReadyForReview detail={detail} onEdit={onEdit} />
        {pullRequest.state === "open" ? (
          <View className="items-start gap-xs">
            <PullRequestMergeButton detail={detail} onEdit={onEdit} />
            <PullRequestMergeStatus detail={detail} onEdit={onEdit} />
          </View>
        ) : null}
      </View>
      <ReadOnlySection title="Checks">
        <PullRequestChecksSummary checks={checks} />
      </ReadOnlySection>
      <Reviewers detail={detail} candidates={candidates} onEdit={onEdit} />
    </View>
  );
}
