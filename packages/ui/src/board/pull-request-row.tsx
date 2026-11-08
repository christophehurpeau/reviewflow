import type { PullRequestRef, ReviewflowBoardPr } from "@reviewflow/sdk";
import {
  AccentScope,
  ExternalLinkText,
  PressableListItem,
  Text,
  View,
} from "alouette";
import { Fragment } from "react";
import type { ReactNode } from "react";
import type { GestureResponderEvent } from "react-native";
import { linkInRow } from "../components/link-in-row.ts";
import { isSafeUrl } from "../markdown-github/safe-url.ts";
import {
  formatPrChanges,
  reviewflowPrChangesRequested,
  reviewflowPrFailure,
  reviewflowPrFlowDate,
  reviewflowPrOwners,
  reviewflowPrProgress,
} from "./facts.ts";
import type { ReviewflowRowContext } from "./facts.ts";

/**
 * Following a link from inside the pressable row must not also press the row.
 */
const stopRowPress = (event: GestureResponderEvent): void => {
  event.stopPropagation();
};

const metaSeparator = <Text className="text-xs text-muted">·</Text>;

const statusSeparator = <Text className="text-sm text-muted">·</Text>;

/** What a row's extra slot is told about the row it sits in. */
export interface BoardRowInfo {
  pr: ReviewflowBoardPr;
  bucketKey: string;
  groupKey: string;
}

export interface PullRequestRowProps {
  row: BoardRowInfo;
  viewer: string | null;
  onOpenPullRequest: (ref: PullRequestRef) => void;
  /** Extra content under the status line (an app's own badges, say). */
  renderRowExtra?: (row: BoardRowInfo) => ReactNode;
}

/**
 * `owner/repo#n`, reviewflow's status links, the size of the change and the
 * flow date. No GitHub link: the row opens the app's pull request screen,
 * which carries Open on GitHub itself.
 */
function MetaLine({ pr }: { pr: ReviewflowBoardPr }): ReactNode {
  const flowDate = reviewflowPrFlowDate(pr);

  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      <Text className="font-mono text-xs text-muted">
        {`${pr.ownerRepo}#${String(pr.number)}`}
      </Text>
      {pr.statusLinks.map((link) => (
        <Fragment key={link.name}>
          {metaSeparator}
          {isSafeUrl(link.url) ? (
            <ExternalLinkText
              size="sm"
              icon={null}
              href={link.url}
              text={link.label}
              aria-label={`Open ${link.label}`}
              className={linkInRow}
              onPress={stopRowPress}
            />
          ) : (
            <Text className="text-xs text-muted">{link.label}</Text>
          )}
        </Fragment>
      ))}
      {pr.changes === null ? null : (
        <>
          {metaSeparator}
          <Text className="text-xs text-muted">
            {formatPrChanges(pr.changes)}
          </Text>
        </>
      )}
      {flowDate === null ? null : (
        <>
          {metaSeparator}
          <Text className="text-xs text-muted">{flowDate}</Text>
        </>
      )}
    </View>
  );
}

/**
 * reviewflow's own status line: what blocks the merge in danger, changes
 * requested in warning, the rest muted. Absent when reviewflow has nothing to
 * say, so a quiet pull request keeps a short card.
 */
function StatusLine({
  pr,
  context,
}: {
  pr: ReviewflowBoardPr;
  context: ReviewflowRowContext;
}): ReactNode {
  const failure = reviewflowPrFailure(pr);
  const changesRequested = reviewflowPrChangesRequested(pr, context.viewer);
  const progress = reviewflowPrProgress(pr, context);
  if (failure === null && changesRequested === null && progress === null) {
    return null;
  }

  return (
    <View className="flex-row flex-wrap items-baseline gap-xs">
      {failure === null ? null : (
        <AccentScope accent="danger">
          <Text className="text-sm font-body-bold text-accent">{failure}</Text>
        </AccentScope>
      )}
      {failure !== null && changesRequested !== null ? statusSeparator : null}
      {changesRequested === null ? null : (
        <AccentScope accent="warning">
          <Text className="text-sm text-accent">{changesRequested}</Text>
        </AccentScope>
      )}
      {(failure !== null || changesRequested !== null) && progress !== null
        ? statusSeparator
        : null}
      {progress === null ? null : (
        <Text className="text-sm text-muted">{progress}</Text>
      )}
    </View>
  );
}

/**
 * One pull request of a reviewflow bucket. Pressing hands its ref to
 * `onOpenPullRequest`; the links of its meta line do not press it.
 */
export function PullRequestRow({
  row,
  viewer,
  onOpenPullRequest,
  renderRowExtra,
}: PullRequestRowProps): ReactNode {
  const { pr } = row;
  const context: ReviewflowRowContext = {
    bucketKey: row.bucketKey,
    groupKey: row.groupKey,
    viewer,
  };
  const owners = reviewflowPrOwners(pr, viewer);
  const extra = renderRowExtra?.(row);

  return (
    <PressableListItem
      role="link"
      aria-label={`Open ${pr.ownerRepo}#${String(pr.number)} ${pr.title}`}
      onPress={() => {
        onOpenPullRequest({ ownerRepo: pr.ownerRepo, number: pr.number });
      }}
    >
      <View className="min-w-0 gap-xxs">
        <MetaLine pr={pr} />
        <View className="flex-row flex-wrap items-baseline gap-xs">
          <Text className="font-body-bold">{pr.title}</Text>
          {owners === null ? null : (
            <Text className="text-sm text-muted">{owners}</Text>
          )}
        </View>
        <StatusLine pr={pr} context={context} />
        {extra === undefined || extra === null ? null : extra}
      </View>
    </PressableListItem>
  );
}
