import type {
  BranchDiffBase,
  BranchDiffScope,
  CheckoutBranchDiffResponse,
  CheckoutCommit,
  CheckoutCommitsResponse,
  CheckoutStatus,
  CommitDiffResponse,
  DiffWhitespace,
} from "@reviewflow/sdk";
import { pluralOf } from "@reviewflow/sdk";
import {
  AccentScope,
  Badge,
  Code,
  Disclosure,
  EmptyState,
  Icon,
  IndeterminateCircularProgress,
  IndeterminateLinearProgress,
  ScrollView,
  SectionTitle,
  Tab,
  Tabs,
  Text,
  View,
  WarningMessage,
  useCurrentBreakpointNameFiltered,
  useCurrentMode,
} from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { ArrowsInLineVerticalRegularIcon } from "alouette-icons/phosphor-icons/ArrowsInLineVertical";
import { ArrowsOutLineVerticalRegularIcon } from "alouette-icons/phosphor-icons/ArrowsOutLineVertical";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircle";
import { ClockCounterClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ClockCounterClockwise";
import { ColumnsRegularIcon } from "alouette-icons/phosphor-icons/Columns";
import { FolderSimpleRegularIcon } from "alouette-icons/phosphor-icons/FolderSimple";
import { GitBranchRegularIcon } from "alouette-icons/phosphor-icons/GitBranch";
import { GitCommitRegularIcon } from "alouette-icons/phosphor-icons/GitCommit";
import { RowsRegularIcon } from "alouette-icons/phosphor-icons/Rows";
import type { ComponentRef, ReactNode } from "react";
import {
  Suspense,
  lazy,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { useDiffSettings } from "./branch-diff/use-diff-settings.tsx";
import { WhitespaceButton } from "./branch-diff/whitespace-button.tsx";
import type { CommitSteps } from "./commit-list.tsx";
import { CommitHeader, CommitList } from "./commit-list.tsx";
import { OmittedFiles } from "./omitted-files.tsx";
import type { PullRequestCollapse } from "./pull-request-diff-collapse.ts";
import { usePullRequestCollapse } from "./pull-request-diff-collapse.ts";
import {
  DiffFileElementsContext,
  createDiffFileElements,
} from "./pull-request-diff-jump.ts";
import { diffTreeFilesOf } from "./pull-request-diff-tree-files.ts";
import type { DiffStyle } from "./pull-request-diff-viewer.tsx";
import { cssVariableOf, scrollToTopOf } from "./scroll-parent.ts";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";

const DiffViewer = lazy(() => import("./diff-viewer.tsx"));
const PullRequestDiffTree = lazy(() => import("./pull-request-diff-tree.tsx"));

/** the tree renders DOM in a shadow root */
const diffTreeAvailable = Platform.OS === "web";

const noViewedPaths: readonly string[] = [];

/**
 * `uncommitted`: the working tree against `HEAD`. `branch`: the commits since
 * the branch left its base, as its pull request shows them. `history`: the
 * last commits of `HEAD`, each opening its own diff.
 */
export type CheckoutTab = "branch" | "history" | "uncommitted";

const isCheckoutTab = (value: string): value is CheckoutTab =>
  value === "uncommitted" || value === "branch" || value === "history";

const shortSha = (sha: string): string => sha.slice(0, 7);

/** The first read, and the viewer's own chunk loading, before anything shows. */
function Loading(): ReactNode {
  return (
    <View className="items-center py-xl">
      <IndeterminateCircularProgress loading />
    </View>
  );
}

/** What a diff body draws: a scope's diff and a commit's both carry it. */
type DiffPatch = Pick<
  CheckoutBranchDiffResponse,
  "groups" | "omitted" | "patch"
>;

interface DiffDisplay {
  diffStyle: DiffStyle;
  collapse: PullRequestCollapse;
}

interface DiffBodyProps extends DiffDisplay {
  diff: DiffPatch | null;
  error: string | null;
  /** shown in place of the files when the patch is empty */
  empty: ReactNode;
}

/**
 * The files beside the diff, as the pull request's diff lists them: pressing
 * one brings it into view and outlines it a moment. On a wide web screen only.
 */
function DiffBody({
  diff,
  error,
  empty,
  diffStyle,
  collapse,
}: DiffBodyProps): ReactNode {
  const mode = useCurrentMode();
  const { wordWrap, theme, fontFamily } = useDiffSettings();
  const fileElements = useMemo(createDiffFileElements, []);
  const highlightProbe = useRef<ComponentRef<typeof View>>(null);
  const wide = useCurrentBreakpointNameFiltered(["base", "wide"]) === "wide";
  const treeFiles = useMemo(
    () => (diff === null ? [] : diffTreeFilesOf(diff)),
    [diff],
  );
  if (diff === null) {
    if (error !== null) return <WarningMessage>{error}</WarningMessage>;
    return <Loading />;
  }
  const hasFiles = diff.patch !== "";
  const aside = wide && diffTreeAvailable && treeFiles.length > 0;

  const goToFile = (path: string): void => {
    const element = fileElements.elementOf(path);
    if (element === undefined) return;
    scrollToTopOf(element, 0);
    const color = cssVariableOf(highlightProbe.current, "--color-enabled");
    if (color !== "") fileElements.highlight(path, color);
  };

  const files = (
    <View className="min-w-0 flex-1 gap-m">
      {error === null ? null : <WarningMessage>{error}</WarningMessage>}
      <OmittedFiles omitted={diff.omitted} />
      {hasFiles ? (
        <Suspense fallback={<Loading />}>
          <DiffFileElementsContext value={fileElements}>
            <DiffViewer
              patch={diff.patch}
              groups={diff.groups}
              diffStyle={diffStyle}
              theme={theme}
              themeType={mode}
              fontFamily={fontFamily}
              wordWrap={wordWrap}
              stickyTop={0}
              collapse={collapse}
            />
          </DiffFileElementsContext>
        </Suspense>
      ) : null}
      {hasFiles || diff.omitted.length > 0 ? null : empty}
    </View>
  );
  if (!aside) return files;

  return (
    <View className="flex-row items-start gap-xl">
      <View className="w-[280px] shrink-0 web:sticky web:top-0 web:h-[calc(100vh-16rem)]">
        <Suspense fallback={<Loading />}>
          <PullRequestDiffTree
            files={treeFiles}
            viewedPaths={noViewedPaths}
            theme={theme}
            onFilePress={goToFile}
          />
        </Suspense>
        {/* the file header is pierre's shadow DOM, which no accent class
            reaches: the color is read here and handed to it */}
        <AccentScope accent="info">
          <View ref={highlightProbe} className="hidden" />
        </AccentScope>
      </View>
      {files}
    </View>
  );
}

interface UpstreamStateProps {
  status: CheckoutStatus;
}

/** Where the branch stands against the remote branch it tracks, as of the last fetch. */
function UpstreamState({ status }: UpstreamStateProps): ReactNode {
  const { branch, upstream, ahead, behind } = status;
  if (branch === null) return null;
  if (upstream === null) {
    return <Text className="text-sm text-muted">not published</Text>;
  }
  if (ahead === null || behind === null) {
    return <Text className="text-sm text-muted">{`${upstream} is gone`}</Text>;
  }
  if (ahead === 0 && behind === 0) {
    return (
      <Text className="text-sm text-muted">{`up to date with ${upstream}`}</Text>
    );
  }
  const moves = [
    ahead === 0 ? null : `${String(ahead)} to push`,
    behind === 0 ? null : `${String(behind)} to pull`,
  ].filter((move) => move !== null);
  return (
    <Text className="text-sm text-muted">
      {`${moves.join(", ")} against ${upstream}`}
    </Text>
  );
}

interface CheckoutContextProps {
  status: CheckoutStatus | null;
  base: BranchDiffBase | null;
  renderBaseExtra: ((base: BranchDiffBase) => ReactNode) | undefined;
}

/**
 * The branch, its remote, where it is on disk and its base. The base is named with its sha since
 * nothing is fetched before a diff: `origin/main` is as fresh as the last fetch.
 */
function CheckoutContext({
  status,
  base,
  renderBaseExtra,
}: CheckoutContextProps): ReactNode {
  if (status === null) return null;
  const showsBase = base !== null && base.name !== status.branch;
  return (
    <View className="flex-row flex-wrap items-center gap-x-m gap-y-xs">
      <View className="flex-row items-center gap-xxs">
        <Icon icon={<GitBranchRegularIcon />} size={14} />
        <Code className="text-sm">{status.branch ?? "detached HEAD"}</Code>
      </View>
      <UpstreamState status={status} />
      <View className="flex-row items-center gap-xxs">
        <Icon icon={<FolderSimpleRegularIcon />} size={14} />
        <Text className="select-auto font-mono text-xs text-muted">
          {status.path}
        </Text>
      </View>
      {showsBase ? (
        <View className="flex-row items-center gap-xs">
          <Text className="text-sm text-muted">from</Text>
          <Code className="text-sm">
            {`${base.ref} @ ${shortSha(base.sha)}`}
          </Code>
          {renderBaseExtra?.(base)}
        </View>
      ) : null}
    </View>
  );
}

const withCount = (label: string, count: number | null): string =>
  count === null || count === 0 ? label : `${label} (${String(count)})`;

const uncommittedCountOf = (status: CheckoutStatus | null): number | null =>
  status === null ? null : status.modified + status.untracked;

interface DiffToolsProps {
  diffStyle: DiffStyle;
  onDiffStyleChange: (style: DiffStyle) => void;
  whitespace: DiffWhitespace;
  onWhitespaceToggle: () => void;
  collapse: PullRequestCollapse;
}

function DiffTools({
  diffStyle,
  onDiffStyleChange,
  whitespace,
  onWhitespaceToggle,
  collapse,
}: DiffToolsProps): ReactNode {
  return (
    <View className="flex-row items-center gap-xs">
      <TooltipIconButton
        icon={
          diffStyle === "split" ? <RowsRegularIcon /> : <ColumnsRegularIcon />
        }
        size="sm"
        aria-label={
          diffStyle === "split" ? "Show unified diff" : "Show split diff"
        }
        onPress={() => {
          onDiffStyleChange(diffStyle === "split" ? "unified" : "split");
        }}
      />
      <WhitespaceButton whitespace={whitespace} onToggle={onWhitespaceToggle} />
      <TooltipIconButton
        icon={<ArrowsOutLineVerticalRegularIcon />}
        size="sm"
        aria-label="Open every file"
        onPress={collapse.expandAll}
      />
      <TooltipIconButton
        icon={<ArrowsInLineVerticalRegularIcon />}
        size="sm"
        aria-label="Close every file"
        onPress={collapse.collapseAll}
      />
    </View>
  );
}

interface NotPushedBadgeProps {
  commit: CheckoutCommit;
}

function NotPushedBadge({ commit }: NotPushedBadgeProps): ReactNode {
  if (commit.pushed !== false) return null;
  return (
    <Badge accent="warning" variant="outlined">
      not pushed
    </Badge>
  );
}

const renderNotPushed = (commit: CheckoutCommit): ReactNode => (
  <NotPushedBadge commit={commit} />
);

/** A diff and the reads behind it, as a query gives them. */
export interface CheckoutRead<Value> {
  /** the last answer; null before the first */
  value: Value | null;
  error: string | null;
  /** a read is running; the answer on screen stays until it settles */
  loading: boolean;
}

export interface CheckoutHistory {
  commits: CheckoutRead<CheckoutCommitsResponse>;
  /** the commit whose diff is open; null shows the list */
  openSha: string | null;
  onOpenChange: (sha: string | null) => void;
  /** the open commit's diff */
  diff: CheckoutRead<CommitDiffResponse>;
}

interface UncommittedBodyProps extends DiffDisplay {
  diff: CheckoutRead<CheckoutBranchDiffResponse>;
  shownDiff: CheckoutBranchDiffResponse | null;
}

function UncommittedBody({
  diff,
  shownDiff,
  ...display
}: UncommittedBodyProps): ReactNode {
  return (
    <DiffBody
      diff={shownDiff}
      error={diff.error}
      empty={
        <EmptyState
          icon={<CheckCircleRegularIcon />}
          title="Nothing uncommitted"
        >
          The working tree matches the last commit.
        </EmptyState>
      }
      {...display}
    />
  );
}

interface BranchCommitsProps {
  commits: CheckoutCommitsResponse;
  onOpen: (sha: string) => void;
}

/** The commits the branch's diff is made of, folded above it. */
function BranchCommits({ commits, onOpen }: BranchCommitsProps): ReactNode {
  const { base, onBranchCount } = commits;
  if (base === null || onBranchCount === null || onBranchCount === 0) {
    return null;
  }
  const listed = commits.commits.filter(({ onBranch }) => onBranch);
  const unlisted = onBranchCount - listed.length;
  return (
    <Disclosure
      guide
      label={`${pluralOf(onBranchCount, "commit")} since ${base.ref}`}
    >
      <View className="gap-xs">
        <CommitList
          commits={listed}
          renderExtra={renderNotPushed}
          onOpen={onOpen}
        />
        {unlisted > 0 ? (
          <Text className="text-xs text-muted">
            {`${pluralOf(unlisted, "older commit")} not listed`}
          </Text>
        ) : null}
      </View>
    </Disclosure>
  );
}

interface BranchBodyProps extends DiffDisplay {
  diff: CheckoutRead<CheckoutBranchDiffResponse>;
  shownDiff: CheckoutBranchDiffResponse | null;
  commits: CheckoutCommitsResponse | null;
  uncommittedCount: number | null;
  /** absent: no history tab to open a commit in, so the commits are not listed */
  onOpenCommit: ((sha: string) => void) | undefined;
}

function BranchBody({
  diff,
  shownDiff,
  commits,
  uncommittedCount,
  onOpenCommit,
  ...display
}: BranchBodyProps): ReactNode {
  const base = shownDiff?.base ?? commits?.base ?? null;
  const branch = shownDiff?.branch ?? commits?.branch ?? null;
  return (
    <View className="gap-m">
      {uncommittedCount === null || uncommittedCount === 0 ? null : (
        <Text className="text-sm text-muted">
          {`Not included: ${pluralOf(uncommittedCount, "uncommitted change")}, under Uncommitted.`}
        </Text>
      )}
      {commits === null || onOpenCommit === undefined ? null : (
        <BranchCommits commits={commits} onOpen={onOpenCommit} />
      )}
      <DiffBody
        diff={shownDiff}
        error={diff.error}
        empty={
          <EmptyState icon={<GitBranchRegularIcon />} title="No branch changes">
            {base === null
              ? "The branch has no commit of its own."
              : `${branch ?? "HEAD"} has no commit that ${base.ref} does not have.`}
          </EmptyState>
        }
        {...display}
      />
    </View>
  );
}

const stepsOf = (
  commits: CheckoutCommit[],
  sha: string,
  onOpen: (sha: string) => void,
): CommitSteps => {
  const index = commits.findIndex(({ oid }) => oid === sha);
  const newer = index > 0 ? commits[index - 1] : undefined;
  const older = index === -1 ? undefined : commits[index + 1];
  return {
    onNewer:
      newer === undefined
        ? null
        : () => {
            onOpen(newer.oid);
          },
    onOlder:
      older === undefined
        ? null
        : () => {
            onOpen(older.oid);
          },
  };
};

interface OpenCommitProps extends DiffDisplay {
  history: CheckoutHistory;
  sha: string;
}

function OpenCommit({ history, sha, ...display }: OpenCommitProps): ReactNode {
  const shownDiff = useDeferredValue(history.diff.value);
  const listed = history.commits.value?.commits ?? [];
  const commit = listed.find(({ oid }) => oid === sha);
  return (
    <View className="gap-m">
      {commit === undefined ? null : (
        <CommitHeader
          commit={commit}
          steps={stepsOf(listed, sha, history.onOpenChange)}
          extra={<NotPushedBadge commit={commit} />}
          onBack={() => {
            history.onOpenChange(null);
          }}
        />
      )}
      <DiffBody
        diff={shownDiff?.sha === sha ? shownDiff : null}
        error={history.diff.error}
        empty={
          <EmptyState icon={<GitCommitRegularIcon />} title="No changes">
            This commit changes no file.
          </EmptyState>
        }
        {...display}
      />
    </View>
  );
}

interface CommitSectionsProps {
  commits: CheckoutCommitsResponse;
  onOpen: (sha: string) => void;
}

/** The branch's own commits apart from the ones it shares with its base. */
function CommitSections({ commits, onOpen }: CommitSectionsProps): ReactNode {
  const { base, branch, onBranchCount } = commits;
  const own = commits.commits.filter(({ onBranch }) => onBranch);
  const shared = commits.commits.filter(({ onBranch }) => !onBranch);
  if (base === null || own.length === 0 || shared.length === 0) {
    return (
      <CommitList
        commits={commits.commits}
        renderExtra={renderNotPushed}
        onOpen={onOpen}
      />
    );
  }
  const unlisted = (onBranchCount ?? own.length) - own.length;
  return (
    <View className="gap-xl">
      <View className="gap-sm">
        <SectionTitle icon={<GitBranchRegularIcon />}>
          {`On ${branch ?? "HEAD"}`}
        </SectionTitle>
        <CommitList
          commits={own}
          renderExtra={renderNotPushed}
          onOpen={onOpen}
        />
        {unlisted > 0 ? (
          <Text className="text-xs text-muted">
            {`${pluralOf(unlisted, "more commit")} not listed`}
          </Text>
        ) : null}
      </View>
      <View className="gap-sm">
        <SectionTitle icon={<ClockCounterClockwiseRegularIcon />}>
          {`On ${base.ref}`}
        </SectionTitle>
        <CommitList
          commits={shared}
          renderExtra={renderNotPushed}
          onOpen={onOpen}
        />
      </View>
    </View>
  );
}

interface HistoryBodyProps extends DiffDisplay {
  history: CheckoutHistory;
}

function HistoryBody({ history, ...display }: HistoryBodyProps): ReactNode {
  const { commits, openSha, onOpenChange } = history;
  if (openSha !== null) {
    return <OpenCommit history={history} sha={openSha} {...display} />;
  }
  if (commits.value === null) {
    if (commits.error !== null) {
      return <WarningMessage>{commits.error}</WarningMessage>;
    }
    return <Loading />;
  }
  return (
    <View className="gap-m">
      {commits.error === null ? null : (
        <WarningMessage>{commits.error}</WarningMessage>
      )}
      {commits.value.commits.length === 0 ? (
        <EmptyState icon={<GitCommitRegularIcon />} title="No commits yet">
          This repository has no commit.
        </EmptyState>
      ) : (
        <CommitSections commits={commits.value} onOpen={onOpenChange} />
      )}
    </View>
  );
}

export interface CheckoutViewProps {
  title: string;
  /** for a dialog's `aria-labelledby` */
  titleId?: string;
  /** the branch, its upstream and what is uncommitted; null before the first read */
  status: CheckoutStatus | null;
  /** null until the caller knows which tab to open first */
  tab: CheckoutTab | null;
  onTabChange: (tab: CheckoutTab) => void;
  /** the open tab's diff: `uncommitted` or `branch`; ignored under `history` */
  diff: CheckoutRead<CheckoutBranchDiffResponse>;
  history: CheckoutHistory;
  /** reads again what the screen shows */
  onReload: () => void;
  whitespace: DiffWhitespace;
  onWhitespaceToggle: () => void;
  /** why the whitespace toggle could not be stored, shown under the toolbar */
  whitespaceError?: string | null;
  /** under the toolbar, e.g. a failed fetch */
  notices?: ReactNode;
  /** before the title, e.g. a back button */
  headerStart?: ReactNode;
  /** before the reload button, e.g. pull and push */
  headerEnd?: ReactNode;
  /** the tabs offered; all three unless set */
  tabs?: CheckoutTab[];
  /** after the base's ref, e.g. where the base was taken from */
  renderBaseExtra?: (base: BranchDiffBase) => ReactNode;
}

const allTabs: CheckoutTab[] = ["uncommitted", "branch", "history"];

/**
 * A checkout: what is uncommitted, what its branch changed since it left its
 * base, and its history, each a tab under the branch and where it stands. It
 * fills its parent, the toolbar fixed and the content scrolling below it, so a
 * dialog and a page both give it a bounded height. Theme, font and word wrap
 * come from `DiffSettingsProvider`; the tab, the open commit and the whitespace
 * are the caller's, since they decide what it reads.
 */
export function CheckoutView({
  title,
  titleId,
  status,
  tab,
  onTabChange,
  diff,
  history,
  onReload,
  whitespace,
  onWhitespaceToggle,
  whitespaceError = null,
  notices,
  headerStart,
  headerEnd,
  tabs = allTabs,
  renderBaseExtra,
}: CheckoutViewProps): ReactNode {
  const [diffStyle, setDiffStyle] = useState<DiffStyle>("split");
  // the viewer is memoized: a press commits at once, the next patch renders after
  const shownDiff = useDeferredValue(diff.value);
  const collapse = usePullRequestCollapse();
  const commits = history.commits.value;
  const uncommittedCount = uncommittedCountOf(status);
  const showsDiff =
    tab === "uncommitted" ||
    tab === "branch" ||
    (tab === "history" && history.openSha !== null);
  const loading =
    tab === "history"
      ? history.commits.loading || history.diff.loading
      : diff.loading || shownDiff !== diff.value;
  const display: DiffDisplay = { diffStyle, collapse };

  // a tab switch shows the last tab's answer for a render: never under the new tab's name
  const diffOf = (scope: BranchDiffScope): CheckoutBranchDiffResponse | null =>
    shownDiff?.scope === scope ? shownDiff : null;

  const openCommit = (sha: string): void => {
    onTabChange("history");
    history.onOpenChange(sha);
  };

  const body = ((): ReactNode => {
    if (tab === null) return <Loading />;
    if (tab === "uncommitted") {
      return (
        <UncommittedBody
          diff={diff}
          shownDiff={diffOf("uncommitted")}
          {...display}
        />
      );
    }
    if (tab === "branch") {
      return (
        <BranchBody
          diff={diff}
          shownDiff={diffOf("committed")}
          commits={commits}
          uncommittedCount={uncommittedCount}
          onOpenCommit={tabs.includes("history") ? openCommit : undefined}
          {...display}
        />
      );
    }
    return <HistoryBody history={history} {...display} />;
  })();

  return (
    <View className="min-h-0 flex-1">
      <View className="gap-m border-b border-muted p-m">
        <View className="flex-row flex-wrap items-center gap-m">
          {headerStart}
          <Text
            id={titleId}
            role="heading"
            aria-level={1}
            className="min-w-0 flex-1 font-heading-extrabold text-2xl"
          >
            {title}
          </Text>
          <View className="flex-row flex-wrap items-center gap-xs">
            {headerEnd}
            <TooltipIconButton
              icon={<ArrowsClockwiseRegularIcon />}
              size="sm"
              variant="soft"
              accent="neutral"
              aria-label="Read the checkout again"
              onPress={onReload}
            />
          </View>
        </View>
        <CheckoutContext
          status={status}
          base={commits?.base ?? null}
          renderBaseExtra={renderBaseExtra}
        />
        <View className="flex-row flex-wrap items-center justify-between gap-m">
          <Tabs
            aria-label="Checkout view"
            value={tab ?? ""}
            onValueChange={(next) => {
              if (isCheckoutTab(next)) onTabChange(next);
            }}
          >
            {tabs.includes("uncommitted") ? (
              <Tab
                value="uncommitted"
                label={withCount("Uncommitted", uncommittedCount)}
              />
            ) : null}
            {tabs.includes("branch") ? (
              <Tab
                value="branch"
                label={withCount("Branch", commits?.onBranchCount ?? null)}
              />
            ) : null}
            {tabs.includes("history") ? (
              <Tab value="history" label="History" />
            ) : null}
          </Tabs>
          {showsDiff ? (
            <DiffTools
              diffStyle={diffStyle}
              whitespace={whitespace}
              collapse={collapse}
              onDiffStyleChange={setDiffStyle}
              onWhitespaceToggle={onWhitespaceToggle}
            />
          ) : null}
        </View>
        {whitespaceError === null ? null : (
          <WarningMessage>{whitespaceError}</WarningMessage>
        )}
        {notices}
      </View>
      {/* what is on screen stays while the next read runs, so the bar says it is being replaced */}
      <IndeterminateLinearProgress loading={loading} size="xs" />
      <ScrollView className="flex-1" contentContainerClassName="p-m">
        {body}
      </ScrollView>
    </View>
  );
}
