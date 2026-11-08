import type {
  DiffOmittedFile,
  DiffStep,
  DiffWhitespace,
  PullRequestDiffResponse,
} from "@reviewflow/sdk";
import {
  AccentScope,
  Code,
  IconButton,
  IndeterminateCircularProgress,
  IndeterminateLinearProgress,
  InfoMessage,
  Tab,
  Tabs,
  Text,
  View,
  WarningMessage,
  useCurrentBreakpointNameFiltered,
  useCurrentMode,
} from "alouette";
import { ArrowsInLineVerticalRegularIcon } from "alouette-icons/phosphor-icons/ArrowsInLineVertical";
import { ArrowsOutLineVerticalRegularIcon } from "alouette-icons/phosphor-icons/ArrowsOutLineVertical";
import { ColumnsRegularIcon } from "alouette-icons/phosphor-icons/Columns";
import { RowsRegularIcon } from "alouette-icons/phosphor-icons/Rows";
import { TreeStructureRegularIcon } from "alouette-icons/phosphor-icons/TreeStructure";
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
import type { PullRequestDiffRefusal } from "../dataSource.ts";
import { usePullRequestReviewDraft } from "../services/PullRequestReviewDraftProvider.tsx";
import { usePullRequestSlots } from "../slots.tsx";
import {
  useDiffSettings,
  useWhitespaceToggle,
} from "./branch-diff/use-diff-settings.tsx";
import { WhitespaceButton } from "./branch-diff/whitespace-button.tsx";
import { usePullRequestCollapse } from "./pull-request-diff-collapse.ts";
import type { PullRequestDiffTarget } from "./pull-request-diff-data.ts";
import {
  useMissingCheckoutReason,
  usePullRequestDiff,
  usePullRequestImpacts,
  usePullRequestReadingOrder,
} from "./pull-request-diff-data.ts";
import type { ImpactsStatus } from "./pull-request-diff-impacts.ts";
import {
  DiffFileElementsContext,
  createDiffFileElements,
} from "./pull-request-diff-jump.ts";
import type { Composer } from "./pull-request-diff-lines.ts";
import type { OverviewReadingOrderStatus } from "./pull-request-diff-overview.tsx";
import { PullRequestDiffOverview } from "./pull-request-diff-overview.tsx";
import { diffTreeFilesOf } from "./pull-request-diff-tree-files.ts";
import type {
  DiffStyle,
  PullRequestDiffReview,
} from "./pull-request-diff-viewer.tsx";
import { cssVariableOf, scrollToTopOf } from "./scroll-parent.ts";

const PullRequestDiffViewer = lazy(
  () => import("./pull-request-diff-viewer.tsx"),
);

const PullRequestDiffTree = lazy(() => import("./pull-request-diff-tree.tsx"));

/** the tree renders DOM in a shadow root */
const diffTreeAvailable = Platform.OS === "web";

type AsideView = "list" | "tree";

const omissionLabel = (reason: DiffOmittedFile["reason"]): string => {
  if (reason === "binary") return "binary";
  if (reason === "tooLarge") return "too large";
  if (reason === "whitespace") return "only whitespace changed";
  return "over the diff budget";
};

function OmittedFiles({ omitted }: { omitted: DiffOmittedFile[] }): ReactNode {
  if (omitted.length === 0) return null;
  return (
    <View className="gap-xxs">
      <Text className="text-xs font-body-bold text-muted">
        {`Left out (${String(omitted.length)})`}
      </Text>
      {omitted.map(({ path, reason }) => (
        <View key={path} className="flex-row flex-wrap items-center gap-xs">
          <Code className="text-xs">{path}</Code>
          <Text className="text-xs text-muted">{omissionLabel(reason)}</Text>
        </View>
      ))}
    </View>
  );
}

interface DiffSourceProps {
  diff: PullRequestDiffResponse;
  asked: DiffWhitespace;
}

/**
 * Said only when git could have answered and did not, or when GitHub could not
 * hide whitespace as asked: a silent fallback hides a broken fetch, and a
 * reindented file read as hidden would be read as rewritten.
 */
function DiffSource({ diff, asked }: DiffSourceProps): ReactNode {
  const fallback =
    diff.source === "git" || diff.fallbackReason === null
      ? null
      : `Read from GitHub: local git could not (${diff.fallbackReason}).`;
  const whitespace =
    asked === "hide" && diff.whitespace === "show"
      ? "Whitespace changes are shown: GitHub's API cannot hide them."
      : null;
  if (fallback === null && whitespace === null) return null;
  return (
    <InfoMessage>
      {[fallback, whitespace].filter((line) => line !== null).join(" ")}
    </InfoMessage>
  );
}

const stepLabels: Record<DiffStep, string> = {
  fetching: "fetching commits…",
  diffing: "computing diff…",
};

/** What a read in progress is waiting on, when the source says: a large fetch takes tens of seconds. */
function DiffLoading({ step }: { step?: DiffStep | null }): ReactNode {
  return (
    <View className="items-center gap-xs py-xl">
      <IndeterminateCircularProgress loading />
      {step === null || step === undefined ? null : (
        <Text className="text-sm text-muted">{stepLabels[step]}</Text>
      )}
    </View>
  );
}

/**
 * The source reads a diff from a local checkout only, and has none for this
 * repository: says which file to edit and the line to add, rather than
 * failing without a reason.
 */
export function DiffRefused({
  refused,
  action,
}: {
  refused: PullRequestDiffRefusal;
  /** overrides the `renderRepositoryAction` slot: a button to where the checkout is configured */
  action?: ReactNode;
}): ReactNode {
  const { reason, ownerRepo, configPath, detail } = refused;
  const { renderRepositoryAction } = usePullRequestSlots();
  const shownAction = action ?? renderRepositoryAction?.(ownerRepo);
  return (
    <WarningMessage>
      <View className="gap-xs">
        <Text className="font-body-bold text-sm">
          {reason === "notConfigured"
            ? `${ownerRepo} has no local checkout configured, so its diff is not read.`
            : `The configured checkout of ${ownerRepo} cannot be used.`}
        </Text>
        <Text className="text-sm">{detail}</Text>
        <Text className="text-sm">
          {"Add the line below to "}
          <Code className="text-sm">{configPath}</Code>, under "repos":
        </Text>
        <Code className="text-sm">{`"${ownerRepo}": "/path/to/checkout"`}</Code>
        {shownAction === null || shownAction === undefined ? null : (
          <View className="flex-row">{shownAction}</View>
        )}
      </View>
    </WarningMessage>
  );
}

interface PullRequestDiffViewProps {
  range: PullRequestDiffTarget;
  /** left of the toolbar: a scope switch, a counter */
  toolbarStart?: ReactNode;
  /** last in the toolbar: the action the diff is read for */
  toolbarEnd?: ReactNode;
  /** absent: read-only, no threads, no commenting */
  review?: PullRequestDiffReview;
}

/**
 * One range of the pull request's diff with the toolbar every diff here has:
 * split/unified, whitespace shown or hidden, open and close every file. Local
 * git when the repository is here, GitHub's API otherwise
 * (`PullRequestDiffResponse`).
 *
 * The toolbar sticks to the top of the scroll container, so what it carries
 * stays in reach down a long diff; the file headers, sticky too, are pinned
 * under it at its measured height rather than behind it. The loading bar is in
 * it, laid over its bottom edge so its height never moves the headers.
 *
 * The viewer renders a deferred diff and is memoized: a toolbar press commits
 * at once, and rendering every file of the next patch is interruptible work
 * that happens after it, rather than a freeze before the press shows.
 *
 * Hiding whitespace is refused while a comment is being written: its line may
 * leave the patch, and the comment with it.
 */
export function PullRequestDiffView({
  range,
  toolbarStart,
  toolbarEnd,
  review,
}: PullRequestDiffViewProps): ReactNode {
  const [diffStyle, setDiffStyle] = useState<DiffStyle>("split");
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const fileElements = useMemo(createDiffFileElements, []);
  const highlightProbe = useRef<ComponentRef<typeof View>>(null);
  // a JS breakpoint rather than `xl:` classes: the sticky offset is the measured toolbar's
  const aside = useCurrentBreakpointNameFiltered(["base", "wide"]) === "wide";
  const whitespace = useWhitespaceToggle();
  const { diff, error, loading, step, refused } = usePullRequestDiff(
    range,
    whitespace.whitespace,
  );
  const shownDiff = useDeferredValue(diff);
  const collapse = usePullRequestCollapse();
  const draft = usePullRequestReviewDraft();
  // a commit's composer; the pull request's lives with the draft, which pins the range
  const [commitComposer, setCommitComposer] = useState<{
    commit: string;
    composer: Composer;
  } | null>(null);
  const shownCommit = review?.commitOid ?? review?.commitFiles?.oid ?? null;
  // kept per commit: stepping to the next commit does not carry it onto its lines
  const shownCommitComposer =
    commitComposer?.commit === shownCommit ? commitComposer.composer : null;
  const onCommitComposerChange = useMemo(
    () =>
      (composer: Composer | null): void => {
        setCommitComposer(
          composer === null || shownCommit === null
            ? null
            : { commit: shownCommit, composer },
        );
      },
    [shownCommit],
  );
  const composing =
    review !== undefined &&
    (shownCommitComposer !== null ||
      (review.commitOid === undefined && draft.composer !== null));
  const mode = useCurrentMode();
  const { wordWrap, theme, fileOrder, setFileOrder } = useDiffSettings();
  const missingCheckout = useMissingCheckoutReason(range);
  const readingOrder = usePullRequestReadingOrder(
    range,
    missingCheckout === null,
  );
  const ordered =
    readingOrder.available &&
    missingCheckout === null &&
    fileOrder === "reading";
  const impacts = usePullRequestImpacts(range, missingCheckout === null);
  const impactsStatus = ((): ImpactsStatus => {
    if (impacts.value !== null) return "ready";
    if (impacts.reading) return "reading";
    if (impacts.error !== null) return "failed";
    return "none";
  })();
  const overviewStatus = ((): OverviewReadingOrderStatus => {
    if (readingOrder.value !== null) return "ready";
    if (readingOrder.reading) return "reading";
    if (readingOrder.error !== null) return "failed";
    return "none";
  })();
  const [requestedAsideView, setRequestedAsideView] =
    useState<AsideView>("tree");
  const asideView: AsideView = diffTreeAvailable ? requestedAsideView : "list";
  const treeFiles = useMemo(
    () => (shownDiff === null ? [] : diffTreeFilesOf(shownDiff)),
    [shownDiff],
  );
  const viewedPaths = (review?.files ?? [])
    .filter(({ viewed }) => viewed === "viewed")
    .map(({ path }) => path);

  const goToFile = (path: string): void => {
    const element = fileElements.elementOf(path);
    if (element === undefined) return;
    scrollToTopOf(element, toolbarHeight);
    const color = cssVariableOf(highlightProbe.current, "--color-enabled");
    if (color !== "") fileElements.highlight(path, color);
  };

  return (
    <View
      className={
        aside && diffStyle === "split"
          ? "gap-m web:relative web:left-1/2 web:w-[100cqw] web:-translate-x-1/2"
          : "gap-m"
      }
    >
      <View
        className="-mx-l flex-row flex-wrap items-center justify-between gap-xs bg-screen px-l py-sm web:sticky web:top-0 web:z-10"
        onLayout={(event) => {
          setToolbarHeight(event.nativeEvent.layout.height);
        }}
      >
        {/* sized to the bar: a zero-height box under the sticky toolbar left
            Chromium painting the faded bar on, at its last width */}
        <View className="absolute inset-x-l bottom-0 h-0.5">
          <IndeterminateLinearProgress
            loading={
              loading || (ordered && readingOrder.reading) || shownDiff !== diff
            }
            size="xs"
          />
        </View>
        <View className="flex-row flex-wrap items-center gap-sm">
          {toolbarStart}
        </View>
        <View className="flex-row items-center gap-xs">
          <IconButton
            icon={
              diffStyle === "split" ? (
                <RowsRegularIcon />
              ) : (
                <ColumnsRegularIcon />
              )
            }
            size="sm"
            aria-label={
              diffStyle === "split" ? "Show unified diff" : "Show split diff"
            }
            onPress={() => {
              setDiffStyle(diffStyle === "split" ? "unified" : "split");
            }}
          />
          {readingOrder.available ? (
            <IconButton
              icon={<TreeStructureRegularIcon />}
              size="sm"
              accent={ordered ? "brand" : "neutral"}
              disabledReason={missingCheckout}
              aria-label={
                ordered
                  ? "Order files by package"
                  : "Order files for reading (experimental)"
              }
              onPress={() => {
                setFileOrder(ordered ? "packages" : "reading");
              }}
            />
          ) : null}
          <WhitespaceButton
            whitespace={whitespace.whitespace}
            disabledReason={
              composing ? "Post or close the comment being written first" : null
            }
            onToggle={whitespace.toggle}
          />
          <IconButton
            icon={<ArrowsOutLineVerticalRegularIcon />}
            size="sm"
            aria-label="Open every file"
            onPress={collapse.expandAll}
          />
          <IconButton
            icon={<ArrowsInLineVerticalRegularIcon />}
            size="sm"
            aria-label="Close every file"
            onPress={collapse.collapseAll}
          />
          {toolbarEnd}
        </View>
      </View>
      {error === null ? null : <WarningMessage>{error}</WarningMessage>}
      {ordered && readingOrder.error !== null ? (
        <WarningMessage>
          {`Files are in package order: the reading order failed (${readingOrder.error})`}
        </WarningMessage>
      ) : null}
      {refused === null ? null : <DiffRefused refused={refused} />}
      {(() => {
        if (shownDiff === null) {
          if (refused !== null || error !== null) return null;
          return <DiffLoading step={step} />;
        }
        return (
          <View className="gap-m">
            <DiffSource diff={shownDiff} asked={whitespace.whitespace} />
            <View className={aside ? "flex-row items-start gap-xl" : "gap-l"}>
              <View
                className={
                  aside
                    ? "w-[280px] shrink-0 gap-sm web:sticky web:max-h-[calc(100vh-8rem)] web:overflow-y-auto"
                    : ""
                }
                style={aside ? { top: toolbarHeight } : undefined}
              >
                {aside && diffTreeAvailable ? (
                  <Tabs
                    aria-label="Files listed"
                    value={asideView}
                    onValueChange={(value) => {
                      setRequestedAsideView(value as AsideView);
                    }}
                  >
                    <Tab value="tree" label="Tree" />
                    <Tab
                      value="list"
                      label={
                        readingOrder.available ? "Reading order" : "Workspaces"
                      }
                    />
                  </Tabs>
                ) : null}
                {aside && asideView === "tree" ? (
                  // a height of its own: the tree virtualizes, and grows to every row without one
                  <View className="web:h-[calc(100vh-12rem)]">
                    <Suspense fallback={<DiffLoading />}>
                      <PullRequestDiffTree
                        files={treeFiles}
                        viewedPaths={viewedPaths}
                        theme={theme}
                        onFilePress={goToFile}
                      />
                    </Suspense>
                  </View>
                ) : (
                  <PullRequestDiffOverview
                    groups={shownDiff.groups}
                    omitted={shownDiff.omitted}
                    readingOrder={readingOrder.value}
                    readingOrderStatus={overviewStatus}
                    impacts={impacts.value}
                    impactsStatus={impactsStatus}
                    displayOrder={
                      (aside && diffTreeAvailable) || ordered
                        ? readingOrder.value
                        : null
                    }
                    aside={aside}
                    onFilePress={goToFile}
                  />
                )}
                {/* the file header is pierre's shadow DOM, which no accent
                    class reaches: the color is read here and handed to it */}
                <AccentScope accent="info">
                  <View ref={highlightProbe} className="hidden" />
                </AccentScope>
              </View>
              <View className="min-w-0 flex-1 gap-m">
                <OmittedFiles omitted={shownDiff.omitted} />
                {shownDiff.patch === "" ? (
                  <Text className="text-muted">no changes</Text>
                ) : (
                  <Suspense fallback={<DiffLoading />}>
                    <DiffFileElementsContext value={fileElements}>
                      <PullRequestDiffViewer
                        pullRequest={range}
                        patch={shownDiff.patch}
                        groups={shownDiff.groups}
                        readingOrder={ordered ? readingOrder.value : null}
                        impacts={impacts.value}
                        sides={shownDiff.sides}
                        whitespace={shownDiff.whitespace}
                        diffStyle={diffStyle}
                        theme={theme}
                        themeType={mode}
                        wordWrap={wordWrap}
                        stickyTop={toolbarHeight}
                        collapse={collapse}
                        review={review}
                        commitComposer={shownCommitComposer}
                        onCommitComposerChange={onCommitComposerChange}
                      />
                    </DiffFileElementsContext>
                  </Suspense>
                )}
              </View>
            </View>
          </View>
        );
      })()}
    </View>
  );
}
