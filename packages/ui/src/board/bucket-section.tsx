import type { PullRequestRef, ReviewflowBoardBucket } from "@reviewflow/sdk";
import type { Accent, SVGIconElement } from "alouette";
import { SectionTitle, Text, View } from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { ChatCircleTextRegularIcon } from "alouette-icons/phosphor-icons/ChatCircleText";
import { EyeRegularIcon } from "alouette-icons/phosphor-icons/Eye";
import { GitMergeRegularIcon } from "alouette-icons/phosphor-icons/GitMerge";
import { GitPullRequestRegularIcon } from "alouette-icons/phosphor-icons/GitPullRequest";
import { PencilSimpleLineRegularIcon } from "alouette-icons/phosphor-icons/PencilSimpleLine";
import { UserPlusRegularIcon } from "alouette-icons/phosphor-icons/UserPlus";
import { UsersRegularIcon } from "alouette-icons/phosphor-icons/Users";
import type { ReactNode } from "react";
import type { BoardRowInfo } from "./pull-request-row.tsx";
import { PullRequestRow } from "./pull-request-row.tsx";

/**
 * Glyphs and accents for the buckets reviewflow ships today, in the pull
 * request badge's colours where they mean the same thing. A bucket it adds
 * later gets the generic glyph and no accent — its title is still reviewflow's.
 */
const icons: Partial<Record<string, SVGIconElement>> = {
  "re-requested-reviews": <ArrowsClockwiseRegularIcon />,
  "requested-reviews": <EyeRegularIcon />,
  "ready-to-merge": <GitMergeRegularIcon />,
  "changes-requested": <ChatCircleTextRegularIcon />,
  "opened-missing-review-request": <UserPlusRegularIcon />,
  drafts: <PencilSimpleLineRegularIcon />,
  "waiting-for-review": <UsersRegularIcon />,
};

const accents: Partial<Record<string, Accent>> = {
  "re-requested-reviews": "warning",
  "requested-reviews": "warning",
  "ready-to-merge": "success",
  "changes-requested": "danger",
  "opened-missing-review-request": "warning",
  "waiting-for-review": "info",
};

export interface BoardBucketSectionProps {
  bucket: ReviewflowBoardBucket;
  groupKey: string;
  viewer: string | null;
  onOpenPullRequest: (ref: PullRequestRef) => void;
  renderRowExtra?: (row: BoardRowInfo) => ReactNode;
  /** Replaces the glyph looked up from a reviewflow bucket key: an app's own section has none. */
  icon?: SVGIconElement;
  /** Replaces the accent looked up from a reviewflow bucket key. */
  accent?: Accent;
}

/**
 * One reviewflow bucket on the screen ground: its title, its rows, and its size
 * in reviewflow when the pages read stop short of it.
 */
export function BoardBucketSection({
  bucket,
  groupKey,
  viewer,
  onOpenPullRequest,
  renderRowExtra,
  icon,
  accent,
}: BoardBucketSectionProps): ReactNode {
  const shown = bucket.prs.length;

  return (
    <View className="gap-xs">
      <SectionTitle
        level={3}
        icon={icon ?? icons[bucket.key] ?? <GitPullRequestRegularIcon />}
        accent={accent ?? accents[bucket.key]}
      >
        {bucket.title}
      </SectionTitle>
      <View className="gap-xs">
        {bucket.prs.map((pr) => (
          <PullRequestRow
            key={pr.id}
            row={{ pr, bucketKey: bucket.key, groupKey }}
            viewer={viewer}
            renderRowExtra={renderRowExtra}
            onOpenPullRequest={onOpenPullRequest}
          />
        ))}
      </View>
      {bucket.total > shown ? (
        <Text className="text-sm text-muted">
          {`Showing ${String(shown)} of ${String(bucket.total)}`}
        </Text>
      ) : null}
    </View>
  );
}
