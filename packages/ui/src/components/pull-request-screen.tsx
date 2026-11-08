import { pullRequestPartsStaleAfter } from "@reviewflow/sdk";
import type {
  DiffFont,
  DiffWhitespace,
  PullRequestDetailResponse,
  PullRequestEdit,
  PullRequestRead,
  PullRequestRef,
} from "@reviewflow/sdk";
import {
  ExternalLinkButton,
  IconButton,
  IndeterminateLinearProgress,
  Text,
  View,
  WarningMessage,
} from "alouette";
import { ArrowClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowClockwise";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";
import type { DraftStore } from "../services/PullRequestDraftsProvider.tsx";
import { PullRequestDraftsProvider } from "../services/PullRequestDraftsProvider.tsx";
import { PullRequestReviewDraftProvider } from "../services/PullRequestReviewDraftProvider.tsx";
import { PullRequestSuggestionBatchProvider } from "../services/PullRequestSuggestionBatchProvider.tsx";
import { formatDataAge } from "../services/formatDataAge.ts";
import { GithubImagesContext } from "../services/githubImages.tsx";
import type { PullRequestSlots } from "../slots.tsx";
import { PullRequestSlotsProvider } from "../slots.tsx";
import type { DiffTheme } from "./branch-diff/diff-themes.ts";
import type { DiffFileOrder } from "./branch-diff/use-diff-settings.tsx";
import { DiffSettingsProvider } from "./branch-diff/use-diff-settings.tsx";
import type { PullRequestTab } from "./pull-request-panel.tsx";
import {
  PullRequestPanel,
  PullRequestSummaryHeader,
} from "./pull-request-panel.tsx";
import {
  PartReadingScope,
  PullRequestPartPending,
  usePartReadingCount,
} from "./pull-request-part-notice.tsx";
import type { RenderRepoLink } from "./pull-request-repo-name.tsx";
import { RepoLinkContext } from "./pull-request-repo-name.tsx";
import { RepositoryAttachmentBanner } from "./repository-attachment-banner.tsx";

/** How old what the header shows is: GitHub's answer, or the last read shown meanwhile. */
const readTimeText = (
  read: Pick<PullRequestRead, "fetchedAt"> | null,
  cached: boolean,
): string => {
  if (read === null) return "";
  const at = formatDataAge(read.fetchedAt);
  return cached
    ? `last read at ${at}, reading GitHub…`
    : `read from GitHub at ${at}`;
};

/** A data source with no summary holds nothing to head the screen with. */
const useNoSummary = (): null => null;

/** A data source that does not say whether a checkout is attached has no banner to show. */
const useNoAttachment = (): null => null;

interface PullRequestBodyProps {
  ownerRepo: string;
  number: number;
  headerStart?: ReactNode;
  tab?: PullRequestTab;
  onTabChange: (tab: PullRequestTab) => void;
  openCommit?: string | null;
  onOpenCommitChange?: (oid: string | null) => void;
  renderBelowHeader?: PullRequestScreenProps["renderBelowHeader"];
  renderHeaderActions?: PullRequestScreenProps["renderHeaderActions"];
}

function PullRequestBody({
  ownerRepo,
  number,
  headerStart,
  tab,
  onTabChange,
  openCommit,
  onOpenCommitChange,
  renderBelowHeader,
  renderHeaderActions,
}: PullRequestBodyProps): ReactNode {
  const dataSource = usePullRequestDataSource();
  const { usePart, useCandidates, reload } = dataSource;
  const useSummary = dataSource.useSummary ?? useNoSummary;
  const ref: PullRequestRef = { ownerRepo, number };
  const summary = useSummary(ref);
  const attachment = (dataSource.useRepositoryAttachment ?? useNoAttachment)(
    ref,
  );
  const detailState = usePart(ref, "detail");
  const checks = usePart(ref, "checks");
  const timeline = usePart(ref, "timeline");
  const { value: candidates, error: candidatesError } = useCandidates(ref);
  const { value: detail, cached, error } = detailState;
  const partsReadInTabs = usePartReadingCount();
  const reading =
    detailState.reading ||
    checks.reading ||
    timeline.reading ||
    partsReadInTabs.count > 0;
  const githubUrl = detail?.pullRequest.url ?? summary?.url ?? null;
  const detailImages = detail?.images;
  const timelineImages = timeline.value?.images;
  const images = useMemo(
    () => ({ ...detailImages, ...timelineImages }),
    [detailImages, timelineImages],
  );

  const onEdited = async (edit: PullRequestEdit): Promise<void> => {
    await reload(
      ref,
      detail === null
        ? undefined
        : pullRequestPartsStaleAfter(edit, detail.pullRequest.id),
    );
  };

  const latest =
    detail === null || cached
      ? null
      : {
          head: detail.pullRequest.headSha,
          base: detail.pullRequest.baseSha,
        };

  return (
    <View className="gap-m">
      <View className="flex-row items-center gap-xs">
        {headerStart}
        <Text className="min-w-0 flex-1 text-right text-sm text-muted">
          {readTimeText(detail, cached)}
        </Text>
        {renderHeaderActions?.(ref, detail)}
        <IconButton
          icon={<ArrowClockwiseRegularIcon />}
          size="sm"
          variant="soft"
          aria-label="Read the pull request again"
          disabled={reading}
          onPress={() => {
            reload(ref).catch(() => undefined);
          }}
        />
        {githubUrl === null ? null : (
          <ExternalLinkButton
            text="Open on GitHub"
            accent="neutral"
            variant="tonal"
            size="sm"
            href={githubUrl}
            openLinkBehavior={{ native: "webBrowser", web: "targetBlank" }}
          />
        )}
      </View>
      {/* any part being read, the first time as over the last read shown, the tabs' too */}
      <IndeterminateLinearProgress loading={reading} size="xs" />
      {renderBelowHeader?.(ref, detail)}
      {attachment === null ? null : (
        <RepositoryAttachmentBanner
          ownerRepo={ownerRepo}
          attachment={attachment}
        />
      )}
      {error === null ? null : <WarningMessage>{error}</WarningMessage>}
      {detail === null && error === null ? (
        <View className="gap-l">
          {summary === null ? null : (
            <PullRequestSummaryHeader summary={summary} />
          )}
          <PullRequestPartPending error={null} what="the pull request" />
        </View>
      ) : null}
      {detail === null ? null : (
        <GithubImagesContext value={images}>
          <PullRequestReviewDraftProvider latest={latest}>
            <PullRequestSuggestionBatchProvider
              pullRequest={detail.pullRequest}
              onEdited={onEdited}
            >
              <PartReadingScope value={partsReadInTabs.report}>
                <PullRequestPanel
                  detail={detail}
                  summary={summary}
                  candidates={candidates}
                  candidatesError={candidatesError}
                  tab={tab}
                  openCommit={openCommit}
                  onEdited={onEdited}
                  onTabChange={onTabChange}
                  onOpenCommitChange={onOpenCommitChange}
                />
              </PartReadingScope>
            </PullRequestSuggestionBatchProvider>
          </PullRequestReviewDraftProvider>
        </GithubImagesContext>
      )}
    </View>
  );
}

export interface PullRequestScreenProps {
  ownerRepo: string;
  number: number;
  /**
   * The tab shown; controlled, so an app can keep it in its url. Absent: the
   * first tab, Review for a reviewer and Conversation for the author.
   */
  tab?: PullRequestTab;
  onTabChange: (tab: PullRequestTab) => void;
  /**
   * The commit whose diff is open on the Commits tab, by oid. Absent: the
   * screen holds it itself; pass both to keep it in a url.
   */
  openCommit?: string | null;
  onOpenCommitChange?: (oid: string | null) => void;
  /** at the start of the top line, before the read time: a back button */
  headerStart?: ReactNode;
  /**
   * Under the top line, where an app shows what it knows about this pull
   * request that GitHub does not (the task carrying it, say). Called with
   * `null` until the detail part has arrived; render nothing if it needs it.
   */
  renderBelowHeader?: (
    ref: PullRequestRef,
    detail: PullRequestDetailResponse | null,
  ) => ReactNode;
  /**
   * Buttons at the end of the top line, before the refresh button (an app's
   * own action on the pull request). Called with `null` until the detail
   * part has arrived.
   */
  renderHeaderActions?: (
    ref: PullRequestRef,
    detail: PullRequestDetailResponse | null,
  ) => ReactNode;
  /** links the repository's name above the title; absent or null: plain text */
  renderRepoLink?: RenderRepoLink;
  /** what the app replaces, see {@link PullRequestSlots} */
  slots?: PullRequestSlots;
  /**
   * Where comments and the review being written are kept between visits.
   * Absent: they live as long as the screen.
   */
  draftStore?: DraftStore;
  /** the diff's syntax theme family; default `reviewflow` */
  diffTheme?: DiffTheme;
  /** the diff's code font; default `alouette` */
  diffFont?: DiffFont;
  /** the CSS `font-family` of the `custom` diff font */
  diffCustomFont?: string;
  /** wrap long lines in the diff; default true */
  diffWordWrap?: boolean;
  /** whether the diff starts with whitespace changes hidden; the toolbar toggle then owns it */
  initialWhitespace?: DiffWhitespace;
  /** the order of the diff's files an app stored; absent, the toolbar toggle owns it */
  diffFileOrder?: DiffFileOrder;
  /** called by the toolbar toggle, for an app that stores the order */
  onDiffFileOrderChange?: (fileOrder: DiffFileOrder) => void;
}

/**
 * One pull request laid out as GitHub's page: the header, then the tabs
 * Conversation, Commits, Checks and Review, with the edits a reviewer
 * or an author makes. Reads and writes through the
 * {@link PullRequestDataSource} of the nearest
 * `PullRequestDataSourceProvider`, which the app provides. Mount it with a
 * `key` of the pull request, so a draft review never leaks to the next one.
 *
 * It fills its parent, and the app chooses how wide that is: its text stays in
 * a 1200px column, and only a split diff beside its file list widens to the
 * whole screen. The screen is the CSS container that diff is sized against
 * (`100cqw`): the window (`100vw`) overflows an app that lays the page beside a
 * sidebar.
 */
export function PullRequestScreen({
  ownerRepo,
  number,
  slots = {},
  draftStore,
  diffTheme,
  diffFont,
  diffCustomFont,
  diffWordWrap,
  initialWhitespace,
  diffFileOrder,
  onDiffFileOrderChange,
  renderRepoLink,
  ...body
}: PullRequestScreenProps): ReactNode {
  return (
    <RepoLinkContext value={renderRepoLink ?? null}>
      <PullRequestSlotsProvider value={slots}>
        <DiffSettingsProvider
          theme={diffTheme}
          font={diffFont}
          customFont={diffCustomFont}
          wordWrap={diffWordWrap}
          initialWhitespace={initialWhitespace}
          fileOrder={diffFileOrder}
          onFileOrderChange={onDiffFileOrderChange}
        >
          <View className="w-full px-l pt-l pb-xl web:@container">
            <View className="mx-auto w-full max-w-[1200px] gap-m">
              <PullRequestDraftsProvider
                store={draftStore}
                pullRequest={{ ownerRepo, number }}
              >
                <PullRequestBody
                  key={`${ownerRepo}#${String(number)}`}
                  ownerRepo={ownerRepo}
                  number={number}
                  {...body}
                />
              </PullRequestDraftsProvider>
            </View>
          </View>
        </DiffSettingsProvider>
      </PullRequestSlotsProvider>
    </RepoLinkContext>
  );
}
