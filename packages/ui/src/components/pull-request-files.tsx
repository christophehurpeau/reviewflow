import type {
  PullRequestCommit,
  PullRequestDetail,
  PullRequestDetailResponse,
  PullRequestEdit,
  PullRequestRef,
  PullRequestThread,
  PullRequestViewerLastReview,
} from "@reviewflow/sdk";
import { formatElapsed, formatRelativeDate, pluralOf } from "@reviewflow/sdk";
import {
  ActionButton,
  Button,
  Code,
  ConfirmationMessage,
  InfoMessage,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Text,
  View,
  WarningMessage,
} from "alouette";
import { BookOpenTextRegularIcon } from "alouette-icons/phosphor-icons/BookOpenText";
import { CaretLeftRegularIcon } from "alouette-icons/phosphor-icons/CaretLeft";
import { CaretRightRegularIcon } from "alouette-icons/phosphor-icons/CaretRight";
import { GitCommitRegularIcon } from "alouette-icons/phosphor-icons/GitCommit";
import type { ComponentRef, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";
import { usePullRequestReviewDraft } from "../services/PullRequestReviewDraftProvider.tsx";
import { errorToMessage } from "../services/errorToMessage.ts";
import { isViewerAuthor } from "../services/isViewerAuthor.ts";
import type { WalkthroughWritingProps } from "../slots.tsx";
import { usePullRequestSlots } from "../slots.tsx";
import { PullRequestReviewButton } from "./pull-request-actions-review.tsx";
import type {
  CommitSummary,
  CommitsToRead,
} from "./pull-request-commit-files.ts";
import {
  commitAnchorings,
  commitsToRead,
  firstCommitAfter,
  summarizeCommits,
  touchDifferentFiles,
} from "./pull-request-commit-files.ts";
import type { PullRequestMovedOn } from "./pull-request-diff-data.ts";
import {
  changedPathsOf,
  useMissingCheckoutReason,
  usePullRequestMovedOn,
  usePullRequestWalkthrough,
} from "./pull-request-diff-data.ts";
import { PullRequestDiffView } from "./pull-request-diff-view.tsx";
import type { PullRequestDiffReview } from "./pull-request-diff-viewer.tsx";
import {
  PullRequestPartError,
  PullRequestPartPending,
  PullRequestPartReading,
} from "./pull-request-part-notice.tsx";
import type { WalkthroughLayout } from "./pull-request-walkthrough.tsx";
import { revealTopOf } from "./scroll-parent.ts";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";

type Scope = "all" | "since";

interface MovedOnNoticeProps {
  movedOn: PullRequestMovedOn | null;
  follow: (() => void) | null;
}

function MovedOnNotice({ movedOn, follow }: MovedOnNoticeProps): ReactNode {
  if (movedOn === null) return null;
  if (follow === null) {
    return (
      <InfoMessage>
        The pull request moved on while your review is in progress. The diff
        stays on the commit the review started on until it is sent or no comment
        is pending or being written. Files changed since cannot be marked
        viewed, and their comments are listed above them rather than on a line.
      </InfoMessage>
    );
  }
  return (
    <InfoMessage>
      <View className="gap-xs">
        <Text>
          The pull request moved on since this diff was shown. Files changed
          since cannot be marked viewed, and their comments are listed above
          them rather than on a line.
        </Text>
        <View className="flex-row">
          <Button
            text="Show the latest changes"
            accent="neutral"
            variant="tonal"
            size="sm"
            onPress={follow}
          />
        </View>
      </View>
    </InfoMessage>
  );
}

function LastReviewRange({
  scope,
  lastReview,
}: {
  scope: Scope;
  lastReview: PullRequestViewerLastReview | null;
}): ReactNode {
  if (scope !== "since" || lastReview === null) return null;
  return (
    <View className="flex-row items-center gap-xs">
      <Text className="text-sm text-muted">from your review on</Text>
      <Code className="text-xs">{lastReview.oid.slice(0, 7)}</Code>
      {lastReview.submittedAt === null ? null : (
        <Text className="text-sm text-muted">
          {formatRelativeDate(lastReview.submittedAt)}
        </Text>
      )}
    </View>
  );
}

interface ByCommitButtonProps {
  byCommit: boolean;
  disabledReason: string | null;
  onToggle: () => void;
}

/** A toggle: brand while the commits are read one by one, as the whitespace one. */
function ByCommitButton({
  byCommit,
  disabledReason,
  onToggle,
}: ByCommitButtonProps): ReactNode {
  return (
    <TooltipIconButton
      icon={<GitCommitRegularIcon />}
      size="sm"
      accent={byCommit ? "brand" : "neutral"}
      disabledReason={disabledReason}
      aria-label={
        byCommit ? "Show all the changes at once" : "Read commit by commit"
      }
      onPress={onToggle}
    />
  );
}

const describeCommit = (
  commit: PullRequestCommit,
  summary: CommitSummary | undefined,
): string => {
  const oid = commit.oid.slice(0, 7);
  if (summary === undefined) return oid;
  const files = pluralOf(summary.files, "file");
  return [oid, summary.workspaces.join(", "), files]
    .filter((part) => part !== "")
    .join(" · ");
};

interface CommitStepperProps {
  commits: PullRequestCommit[];
  /** aligned with `commits` */
  summaries: CommitSummary[];
  index: number;
  onIndexChange: (index: number) => void;
}

function CommitStepper({
  commits,
  summaries,
  index,
  onIndexChange,
}: CommitStepperProps): ReactNode {
  const commit = commits[index];
  if (commit === undefined) return null;
  return (
    <View className="min-w-0 shrink flex-row items-center gap-xs">
      <TooltipIconButton
        icon={<CaretLeftRegularIcon />}
        size="sm"
        accent="neutral"
        aria-label="Previous commit"
        disabledReason={index === 0 ? "This is the first commit" : null}
        onPress={() => {
          onIndexChange(index - 1);
        }}
      />
      <Menu
        label="Commits"
        render={(triggerProps) => (
          <Button
            text={`${String(index + 1)} / ${String(commits.length)}`}
            accent="neutral"
            variant="soft"
            size="sm"
            {...triggerProps}
          />
        )}
      >
        {commits.map((item, itemIndex) => (
          <MenuItem
            key={item.oid}
            label={item.headline}
            description={describeCommit(item, summaries[itemIndex])}
            checked={itemIndex === index}
            onPress={() => {
              onIndexChange(itemIndex);
            }}
          />
        ))}
      </Menu>
      <TooltipIconButton
        icon={<CaretRightRegularIcon />}
        size="sm"
        accent="neutral"
        aria-label="Next commit"
        disabledReason={
          index === commits.length - 1 ? "This is the last commit" : null
        }
        onPress={() => {
          onIndexChange(index + 1);
        }}
      />
      <Text className="min-w-0 shrink text-sm font-body-bold" numberOfLines={1}>
        {commit.headline}
      </Text>
      <Code className="text-xs">{commit.oid.slice(0, 7)}</Code>
    </View>
  );
}

interface CommitByCommitParams {
  pullRequest: PullRequestDetail;
  /** the head the diff shows, null until known */
  head: string | null;
  /** step through the commits after this one only */
  since: string | null;
}

interface CommitByCommit {
  /** null while the commits are read */
  toRead: CommitsToRead | null;
  /** why the reader cannot turn it on */
  disabledReason: string | null;
  on: boolean;
  /** on by default, the reader has not toggled it */
  automatic: boolean;
  /** the default is not known yet: decided before the diff shows, so it does not swap under the reader */
  waiting: boolean;
  /** why the commits' files could not be read, once the reader asked for them */
  error: string | null;
  stepped: PullRequestCommit[];
  /** aligned with `stepped` */
  summaries: CommitSummary[];
  index: number;
  setIndex: (index: number) => void;
  shown: {
    commit: PullRequestCommit;
    files: NonNullable<PullRequestDiffReview["commitFiles"]>;
  } | null;
  toggle: () => void;
}

const useCommitByCommit = ({
  pullRequest,
  head,
  since,
}: CommitByCommitParams): CommitByCommit => {
  const dataSource = usePullRequestDataSource();
  const commits = dataSource.usePart(pullRequest, "commits");
  const missingCheckout = useMissingCheckoutReason(pullRequest);
  const [requested, setRequested] = useState<boolean | null>(null);
  const [requestedIndex, setRequestedIndex] = useState(0);
  const toRead =
    head === null || commits.value === null
      ? null
      : commitsToRead({
          listed: commits.value.commits,
          total: pullRequest.commitsTotal,
          head,
        });
  const readable =
    toRead?.kind === "available" && missingCheckout === null
      ? toRead.commits
      : null;
  const diffs = dataSource.useDiffs(
    pullRequest,
    readable === null || requested === false
      ? null
      : readable.map(({ oid, parentOid }) => ({
          head: oid,
          base: parentOid ?? oid,
          // a file changed by whitespace alone is changed all the same
          whitespace: "show",
        })),
  );
  // a cached value is the previous ranges', kept while these load
  const pathsByCommit = useMemo(
    () => (diffs.cached ? null : (diffs.value?.map(changedPathsOf) ?? null)),
    [diffs.cached, diffs.value],
  );
  const wanted =
    requested ??
    (pathsByCommit === null ? null : touchDifferentFiles(pathsByCommit));
  const failed = diffs.error !== null || diffs.refused !== null;
  const on = readable !== null && pathsByCommit !== null && wanted === true;
  const sinceIndex = readable === null ? 0 : firstCommitAfter(readable, since);
  const stepped = readable?.slice(sinceIndex) ?? [];
  const index = Math.min(requestedIndex, Math.max(stepped.length - 1, 0));
  const commit = on ? stepped[index] : undefined;
  const summaries =
    on && diffs.value !== null && pathsByCommit !== null
      ? summarizeCommits({ diffs: diffs.value, pathsByCommit, sinceIndex })
      : [];

  return {
    toRead,
    disabledReason:
      toRead?.kind === "unavailable" ? toRead.reason : missingCheckout,
    on,
    automatic: on && requested === null,
    waiting:
      readable !== null &&
      wanted !== false &&
      pathsByCommit === null &&
      !failed,
    error: requested === true ? diffs.error : null,
    stepped,
    summaries,
    index,
    setIndex: setRequestedIndex,
    shown:
      commit === undefined || pathsByCommit === null
        ? null
        : {
            commit,
            files: {
              oid: commit.oid,
              anchorings: commitAnchorings(pathsByCommit, sinceIndex + index),
            },
          },
    toggle: () => {
      setRequested(!on);
    },
  };
};

type ReadAs = "files" | "walkthrough";

const elapsedTickMs = 15_000;

/** How long ago the walkthrough was asked, counted on while the reader waits. */
function WalkthroughWritingNotice({
  response,
}: WalkthroughWritingProps): ReactNode {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, elapsedTickMs);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <Text className="text-sm text-muted">
      {`Walkthrough being written for ${formatElapsed(response.requestedAt ?? now, now)}`}
    </Text>
  );
}

/** Where the walkthrough's state sits in its line: at the end, under the toolbar's buttons. */
function WalkthroughStatusLine({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <View className="flex-1 flex-row flex-wrap items-center justify-end gap-sm">
      {children}
    </View>
  );
}

interface WalkthroughControlsProps {
  pullRequest: PullRequestRef;
  walkthrough: ReturnType<typeof usePullRequestWalkthrough>;
  readAs: ReadAs;
  onReadAsChange: (readAs: ReadAs) => void;
  layout: WalkthroughLayout;
  onLayoutChange: (layout: WalkthroughLayout) => void;
}

/**
 * The line the walkthrough button opens under the toolbar: files or the
 * walkthrough, and its layout, once one is on the range; how far the agent
 * writing it is; the way to bring one written before the latest commits up to
 * date, or to write one.
 */
function WalkthroughControls({
  pullRequest,
  walkthrough,
  readAs,
  onReadAsChange,
  layout,
  onLayoutChange,
}: WalkthroughControlsProps): ReactNode {
  const { renderWalkthroughWriting } = usePullRequestSlots();
  const { value, request, update } = walkthrough;
  if (value?.walkthrough != null) {
    return (
      <>
        <Tabs
          aria-label="Diff read as"
          value={readAs}
          onValueChange={(next) => {
            onReadAsChange(next as ReadAs);
          }}
        >
          <Tab value="walkthrough" label="Walkthrough" />
          <Tab value="files" label="Files" />
        </Tabs>
        {readAs === "walkthrough" ? (
          <Tabs
            aria-label="Walkthrough layout"
            value={layout}
            onValueChange={(next) => {
              onLayoutChange(next as WalkthroughLayout);
            }}
          >
            <Tab value="stepper" label="Step by step" />
            <Tab value="stacked" label="All steps" />
          </Tabs>
        ) : null}
      </>
    );
  }
  if (value?.requestedAt != null) {
    const props: WalkthroughWritingProps = {
      pullRequest,
      response: value,
      request,
    };
    return (
      <WalkthroughStatusLine>
        {renderWalkthroughWriting === undefined ? (
          <WalkthroughWritingNotice {...props} />
        ) : (
          renderWalkthroughWriting(props)
        )}
      </WalkthroughStatusLine>
    );
  }
  if (value?.older != null) {
    return (
      <WalkthroughStatusLine>
        <Text className="text-sm text-muted">
          {`The walkthrough was written on ${value.older.head.slice(0, 7)}, before the latest commits.`}
        </Text>
        {update === null ? null : (
          <ActionButton
            text="Update the walkthrough"
            accent="brand"
            variant="tonal"
            size="sm"
            errorToMessage={errorToMessage}
            onPress={update}
          />
        )}
        {request === null ? null : (
          <ActionButton
            text="Write a new one"
            accent="neutral"
            variant="tonal"
            size="sm"
            errorToMessage={errorToMessage}
            onPress={request}
          />
        )}
      </WalkthroughStatusLine>
    );
  }
  if (request === null) return null;
  return (
    <WalkthroughStatusLine>
      <ActionButton
        text="Write a walkthrough"
        accent="neutral"
        variant="tonal"
        size="sm"
        errorToMessage={errorToMessage}
        onPress={request}
      />
    </WalkthroughStatusLine>
  );
}

/**
 * The pull request's diff with its review state: viewed marks, threads on the
 * lines and commenting. Scope "since your last review" diffs the head against
 * the head the viewer last reviewed on; GitHub's line numbers for the old side
 * then name the pull request's base, not that commit, so only the new side is
 * annotated or commentable there.
 *
 * Review changes is the one place a review is sent from, so it ends the diff's
 * toolbar, which sticks to the top of the scroll container. The author gets
 * neither it nor Start a review — GitHub lets them comment, one comment at a
 * time, not review.
 *
 * The range is the draft's: a push is announced, not shown, until the reader
 * asks for it, which a review in progress withholds.
 *
 * The commits can be read one by one, which is the default when no two of
 * them change the same file: each file of a commit is then the pull request's
 * own, so it is reviewed as on the whole diff. A file changed by another
 * commit too is reviewed on what it shares with the pull request's diff
 * (`CommitFileAnchoring`). With "since your last review", only the commits
 * pushed since are stepped through. Off without a local checkout: from
 * GitHub, telling the default would cost a request a commit. Turned on by
 * default over more than one commit, it says so in a confirmation message
 * above the diff: the reader did not ask for it, and the stepper alone is
 * easy to miss.
 *
 * Stepping to another commit, toggling commit by commit or switching the
 * scope swaps the diff for a loader. A reader down the diff is first brought
 * back to its top, and the diff's area keeps a screen's height, so the page
 * shrinking under the loader does not scroll them up to the description.
 */
export interface PullRequestFilesTabProps {
  detail: PullRequestDetailResponse;
  /** reads the pull request again once GitHub took a change */
  onEdited: (edit: PullRequestEdit) => Promise<void>;
}

export function PullRequestFiles({
  detail,
  onEdited,
}: PullRequestFilesTabProps): ReactNode {
  const { pullRequest } = detail;
  const isAuthor = isViewerAuthor(detail);
  const [requested, setRequested] = useState<Scope>("all");
  const [viewedError, setViewedError] = useState<string | null>(null);
  const [byCommitNoticeDismissed, setByCommitNoticeDismissed] = useState(false);
  const dataSource = usePullRequestDataSource();
  const files = dataSource.usePart(pullRequest, "files");
  const timeline = dataSource.usePart(pullRequest, "timeline");
  const { shas, latest, follow } = usePullRequestReviewDraft();
  const movedOn = usePullRequestMovedOn(pullRequest, shas, latest);
  const walkthrough = usePullRequestWalkthrough(pullRequest, shas);
  const [requestedReadAs, setRequestedReadAs] = useState<ReadAs | null>(null);
  const [walkthroughLayout, setWalkthroughLayout] =
    useState<WalkthroughLayout>("stepper");
  const [requestedRowOpen, setRequestedRowOpen] = useState<boolean | null>(
    null,
  );
  const hasWalkthrough = walkthrough.value?.walkthrough != null;
  // a walkthrough on the range keeps its line, which switches to the files;
  // one being written or outdated opens it until the reader closes it
  const walkthroughRowOpen =
    hasWalkthrough ||
    (requestedRowOpen ??
      (walkthrough.value?.requestedAt != null ||
        walkthrough.value?.older != null));
  const readAs = requestedReadAs ?? (hasWalkthrough ? "walkthrough" : "files");
  const shownWalkthrough =
    readAs === "walkthrough" ? (walkthrough.value?.walkthrough ?? null) : null;
  const lastReview = files.value?.viewerLastReview ?? null;
  const sinceAvailable =
    shownWalkthrough === null &&
    lastReview !== null &&
    lastReview.oid !== shas?.head;
  const scope: Scope = sinceAvailable ? requested : "all";
  const byCommit = useCommitByCommit({
    pullRequest,
    head: shas?.head ?? null,
    since: scope === "since" ? (lastReview?.oid ?? null) : null,
  });
  // a walkthrough is written on the whole pull request, never on one commit
  const shownStep = shownWalkthrough === null ? byCommit.shown : null;
  const shownCommit = shownStep?.commit;
  const commitFiles = shownStep?.files;
  const diffArea = useRef<ComponentRef<typeof View>>(null);
  const revealDiffTop = (): void => {
    const element: unknown = diffArea.current;
    if (typeof HTMLElement !== "undefined" && element instanceof HTMLElement) {
      revealTopOf(element, 0);
    }
  };
  const viewedCount = (files.value?.files ?? []).filter(
    ({ viewed }) => viewed === "viewed",
  ).length;

  const onEdit = async (edit: PullRequestEdit): Promise<void> => {
    await dataSource.edit(pullRequest, edit);
    await onEdited(edit);
  };

  return (
    <View className="gap-m">
      {viewedError === null ? null : (
        <WarningMessage
          dismissIconAriaLabel="Dismiss"
          onDismiss={() => {
            setViewedError(null);
          }}
        >
          {viewedError}
        </WarningMessage>
      )}
      <PullRequestPartError error={files.error ?? timeline.error} />
      {files.value === null || timeline.value === null ? (
        <PullRequestPartPending
          error={null}
          what="the viewed marks and threads"
        />
      ) : (
        <PullRequestPartReading reading={files.reading || timeline.reading} />
      )}
      <MovedOnNotice movedOn={movedOn} follow={follow} />
      {shownWalkthrough === null &&
      byCommit.automatic &&
      byCommit.stepped.length > 1 &&
      !byCommitNoticeDismissed ? (
        <ConfirmationMessage
          dismissIconAriaLabel="Dismiss"
          onDismiss={() => {
            setByCommitNoticeDismissed(true);
          }}
        >
          {`Read commit by commit: no two commits change the same file, so each of the ${String(byCommit.stepped.length)} commits is reviewed as part of the pull request. The commit button in the toolbar shows every change at once.`}
        </ConfirmationMessage>
      ) : null}
      {byCommit.error === null ? null : (
        <WarningMessage>
          {`The commits' files could not be read: ${byCommit.error}`}
        </WarningMessage>
      )}
      <View ref={diffArea} className="web:min-h-screen">
        {(() => {
          if (shas === null) {
            return (
              <PullRequestPartPending
                error={null}
                what="the pull request's head"
              />
            );
          }
          if (shownWalkthrough === null && byCommit.waiting) {
            return (
              <PullRequestPartPending
                error={null}
                what="the files each commit changes"
              />
            );
          }
          return (
            <PullRequestDiffView
              range={{
                ownerRepo: pullRequest.ownerRepo,
                number: pullRequest.number,
                head: shownCommit?.oid ?? shas.head,
                base: (() => {
                  if (shownCommit !== undefined) {
                    return shownCommit.parentOid ?? shas.base;
                  }
                  if (scope === "since" && lastReview !== null) {
                    return lastReview.oid;
                  }
                  return shas.base;
                })(),
              }}
              toolbarStart={
                <>
                  {shownWalkthrough !== null ||
                  byCommit.toRead === null ||
                  byCommit.toRead.kind === "none" ? null : (
                    <ByCommitButton
                      byCommit={byCommit.on}
                      disabledReason={byCommit.disabledReason}
                      onToggle={() => {
                        revealDiffTop();
                        byCommit.toggle();
                      }}
                    />
                  )}
                  {sinceAvailable ? (
                    <Tabs
                      aria-label="Changes shown"
                      value={scope}
                      onValueChange={(value) => {
                        revealDiffTop();
                        setRequested(value as Scope);
                        byCommit.setIndex(0);
                      }}
                    >
                      <Tab value="all" label="All changes" />
                      <Tab value="since" label="Since your last review" />
                    </Tabs>
                  ) : null}
                  <LastReviewRange scope={scope} lastReview={lastReview} />
                  <Text className="text-sm text-muted">
                    {`${String(viewedCount)} / ${String(pullRequest.changedFiles)} viewed`}
                  </Text>
                  {shownStep === null || shownStep === undefined ? null : (
                    <CommitStepper
                      commits={byCommit.stepped}
                      summaries={byCommit.summaries}
                      index={byCommit.index}
                      onIndexChange={(index) => {
                        revealDiffTop();
                        byCommit.setIndex(index);
                      }}
                    />
                  )}
                </>
              }
              orderEnd={
                walkthrough.available ? (
                  <TooltipIconButton
                    icon={<BookOpenTextRegularIcon />}
                    size="sm"
                    accent={walkthroughRowOpen ? "brand" : "neutral"}
                    disabledReason={
                      hasWalkthrough
                        ? "A walkthrough is written on this range: its line switches to the files"
                        : null
                    }
                    aria-label={
                      walkthroughRowOpen
                        ? "Hide the walkthrough"
                        : "Walkthrough"
                    }
                    onPress={() => {
                      revealDiffTop();
                      setRequestedRowOpen(!walkthroughRowOpen);
                    }}
                  />
                ) : null
              }
              toolbarRow={
                walkthroughRowOpen ? (
                  <WalkthroughControls
                    pullRequest={pullRequest}
                    walkthrough={walkthrough}
                    readAs={readAs}
                    layout={walkthroughLayout}
                    onReadAsChange={(next) => {
                      revealDiffTop();
                      setRequestedReadAs(next);
                    }}
                    onLayoutChange={(next) => {
                      revealDiffTop();
                      setWalkthroughLayout(next);
                    }}
                  />
                ) : null
              }
              toolbarEnd={
                isAuthor ? null : (
                  <PullRequestReviewButton detail={detail} onEdit={onEdit} />
                )
              }
              walkthrough={
                shownWalkthrough === null
                  ? null
                  : { walkthrough: shownWalkthrough, layout: walkthroughLayout }
              }
              review={{
                headSha: shas.head,
                threads:
                  timeline.value?.timeline.filter(
                    (item): item is PullRequestThread => item.kind === "thread",
                  ) ?? null,
                files: files.value?.files ?? null,
                commentable: true,
                rightOnly: scope === "since" && commitFiles === undefined,
                commitFiles,
                reviewable: !isAuthor,
                movedOn,
                onEdit,
                onViewed: async (path, viewed) => {
                  try {
                    await onEdit({ kind: "viewed", path, viewed });
                    setViewedError(null);
                  } catch (error) {
                    setViewedError(errorToMessage(error));
                  }
                },
              }}
            />
          );
        })()}
      </View>
    </View>
  );
}
