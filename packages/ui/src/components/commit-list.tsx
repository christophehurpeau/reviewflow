import type { PullRequestCommit } from "@reviewflow/sdk";
import { Button, Code, PressableListItem, Text, View } from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { CaretDownRegularIcon } from "alouette-icons/phosphor-icons/CaretDown";
import { CaretUpRegularIcon } from "alouette-icons/phosphor-icons/CaretUp";
import type { ReactNode } from "react";
import { formatDataAge } from "../services/formatDataAge.ts";
import { groupByDay } from "../services/groupByDay.ts";
import { PersonAvatar } from "./pull-request-conversation-person.tsx";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";

const shortSha = (oid: string): string => oid.slice(0, 7);

interface CommitRowProps<Commit extends PullRequestCommit> {
  commit: Commit;
  onOpen: () => void;
  extra: ReactNode;
}

/** A link, as a board row is: it opens the commit's own diff. */
function CommitRow<Commit extends PullRequestCommit>({
  commit,
  onOpen,
  extra,
}: CommitRowProps<Commit>): ReactNode {
  const login = commit.author?.login ?? "unknown";

  return (
    <PressableListItem
      role="link"
      aria-label={`Show the changes of ${commit.headline}`}
      onPress={onOpen}
    >
      <View className="flex-row items-center gap-sm">
        <PersonAvatar person={commit.author} />
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-body-bold" numberOfLines={1}>
            {commit.headline}
          </Text>
          <Text className="text-xs text-muted" numberOfLines={1}>
            {`${login} committed ${formatDataAge(commit.committedAt)}`}
          </Text>
        </View>
        {extra}
        <Code className="text-xs">{shortSha(commit.oid)}</Code>
      </View>
    </PressableListItem>
  );
}

export interface CommitListProps<Commit extends PullRequestCommit> {
  /** in the order to show them; a day heads each run of commits made that day */
  commits: Commit[];
  onOpen: (oid: string) => void;
  /** beside the commit's short sha, e.g. a badge */
  renderExtra?: (commit: Commit) => ReactNode;
}

/** Commits grouped by day as on GitHub; pressing one opens its own diff. */
export function CommitList<Commit extends PullRequestCommit>({
  commits,
  onOpen,
  renderExtra,
}: CommitListProps<Commit>): ReactNode {
  return (
    <View className="gap-m">
      {groupByDay(commits, (commit) => commit.committedAt).map(
        ({ day, items }) => (
          <View key={day} className="gap-xs">
            <Text className="text-xs font-body-bold text-muted">{day}</Text>
            {items.map((commit) => (
              <CommitRow
                key={commit.oid}
                commit={commit}
                extra={renderExtra?.(commit)}
                onOpen={() => {
                  onOpen(commit.oid);
                }}
              />
            ))}
          </View>
        ),
      )}
    </View>
  );
}

/** Steps to the neighbouring commits of the list; null at its end. */
export interface CommitSteps {
  onNewer: (() => void) | null;
  onOlder: (() => void) | null;
}

function CommitStepButtons({ onNewer, onOlder }: CommitSteps): ReactNode {
  return (
    <View className="flex-row items-center gap-xxs">
      <TooltipIconButton
        icon={<CaretUpRegularIcon />}
        size="sm"
        aria-label="Newer commit"
        disabledReason={onNewer === null ? "This is the newest commit" : null}
        onPress={() => {
          onNewer?.();
        }}
      />
      <TooltipIconButton
        icon={<CaretDownRegularIcon />}
        size="sm"
        aria-label="Older commit"
        disabledReason={onOlder === null ? "This is the oldest commit" : null}
        onPress={() => {
          onOlder?.();
        }}
      />
    </View>
  );
}

interface CommitHeaderProps {
  commit: PullRequestCommit;
  onBack: () => void;
  /** absent: the commit cannot be stepped from */
  steps?: CommitSteps;
  /** beside the commit's short sha, e.g. a badge */
  extra?: ReactNode;
}

/** Above a commit's own diff: the way back to the list, its message and its sha. */
export function CommitHeader({
  commit,
  onBack,
  steps,
  extra,
}: CommitHeaderProps): ReactNode {
  return (
    <View className="gap-m">
      <View className="flex-row flex-wrap items-center gap-sm">
        <Button
          text="Back to commits"
          icon={<ArrowLeftRegularIcon />}
          accent="neutral"
          variant="tonal"
          size="sm"
          onPress={onBack}
        />
        <Text className="min-w-0 flex-1 text-sm font-body-bold">
          {commit.headline}
        </Text>
        {extra}
        <Code className="text-xs">{shortSha(commit.oid)}</Code>
        {steps === undefined ? null : <CommitStepButtons {...steps} />}
      </View>
      {commit.body.trim() === "" ? null : (
        <Text className="select-auto font-mono text-xs text-muted">
          {commit.body}
        </Text>
      )}
    </View>
  );
}
