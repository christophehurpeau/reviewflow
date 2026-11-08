import type {
  PullRequestCheck,
  PullRequestDetail,
  PullRequestDetailResponse,
  PullRequestEdit,
  PullRequestRef,
  ReviewflowPrDetail,
  ReviewflowPrResponse,
} from "@reviewflow/sdk";
import { checksFromReviewflow } from "@reviewflow/sdk";
import {
  Disclosure,
  ErrorMessage,
  IndeterminateCircularProgress,
  Text,
  View,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import type { PullRequestReadState } from "../dataSource.ts";
import { usePullRequestDataSource } from "../dataSource.ts";
import { CheckLine } from "./pull-request-checks.tsx";
import { PullRequestFiles } from "./pull-request-files.tsx";
import {
  PullRequestDescription,
  PullRequestTimelineEntries,
  conversationCount,
} from "./pull-request-timeline.tsx";

/** A data source without reviewflow judges no check. */
const useNoReviewflowPr = (
  _ref: PullRequestRef,
): PullRequestReadState<ReviewflowPrResponse> | null => null;

const countText = (count: number, what: string): string =>
  `${String(count)} ${what}`;

const blockingSummary = (failed: number, pending: number): string => {
  if (failed === 0) return countText(pending, "pending");
  if (pending === 0) return countText(failed, "failing");
  return `${countText(failed, "failing")}, ${countText(pending, "pending")}`;
};

/** reviewflow names its failures; their link and description are its stored runs'. */
const failedChecks = (
  { checks }: ReviewflowPrDetail,
  at: string,
): PullRequestCheck[] => {
  const stored =
    checks.checkRuns === null || checks.statuses === null
      ? []
      : checksFromReviewflow(
          { checkRuns: checks.checkRuns, statuses: checks.statuses },
          at,
        ).checks;
  return checks.failedNames.map(
    (name) =>
      stored.find((check) => check.name === name) ?? {
        name,
        outcome: "failed",
        running: false,
        description: null,
        url: null,
      },
  );
};

/**
 * reviewflow's verdict on the checks, not GitHub's raw list: it leaves out
 * the checks allowed to fail, the jobs on hold and its own check, which waits
 * on this very review. Said, not enforced.
 */
function ChecksBlocker({
  pullRequest,
}: {
  pullRequest: PullRequestDetail;
}): ReactNode {
  const dataSource = usePullRequestDataSource();
  const read = (dataSource.useReviewflowPr ?? useNoReviewflowPr)(pullRequest);
  if (read === null) return null;
  if (read.value === null) {
    if (read.error !== null) {
      return (
        <WarningMessage>
          {`reviewflow could not be read: ${read.error}`}
        </WarningMessage>
      );
    }
    return (
      <View className="flex-row items-center gap-xs">
        <IndeterminateCircularProgress loading size="xs" />
        <Text className="text-sm text-muted">
          Reading the checks from reviewflow…
        </Text>
      </View>
    );
  }
  const { pr } = read.value;
  if (pr === null) {
    return (
      <WarningMessage>
        reviewflow holds no copy of this pull request: the checks are not judged
        here.
      </WarningMessage>
    );
  }
  const { conclusion, running } = pr.checks;
  if (conclusion !== "failed" && conclusion !== "inProgress") return null;
  const failed = failedChecks(pr, pr.updatedAt);
  return (
    <ErrorMessage>
      <View className="gap-xs">
        <Text className="font-body-bold">
          {`The checks block this review: ${blockingSummary(failed.length, running)}.`}
        </Text>
        {failed.map((check) => (
          <CheckLine key={check.name} check={check} />
        ))}
      </View>
    </ErrorMessage>
  );
}

const useConversationLabel = (pullRequest: PullRequestDetail): string => {
  const { value } = usePullRequestDataSource().usePart(pullRequest, "timeline");
  return value === null
    ? "Comments and reviews"
    : `Comments and reviews (${String(conversationCount(value.timeline))})`;
};

export interface PullRequestReviewProps {
  detail: PullRequestDetailResponse;
  /** reads the pull request again once GitHub took a change */
  onEdited: (edit: PullRequestEdit) => Promise<void>;
}

/**
 * The pull request as a reviewer reads it, top to bottom: what the checks
 * still say against it, the description, the conversation folded away, then
 * the files to review.
 */
export function PullRequestReview({
  detail,
  onEdited,
}: PullRequestReviewProps): ReactNode {
  const { pullRequest } = detail;
  const conversationLabel = useConversationLabel(pullRequest);
  return (
    <View className="gap-l">
      <ChecksBlocker pullRequest={pullRequest} />
      <PullRequestDescription detail={detail} onEdited={onEdited} />
      <Disclosure label={conversationLabel}>
        <View className="gap-m">
          <PullRequestTimelineEntries
            conversationOnly
            detail={detail}
            onEdited={onEdited}
          />
        </View>
      </Disclosure>
      <PullRequestFiles detail={detail} onEdited={onEdited} />
    </View>
  );
}
