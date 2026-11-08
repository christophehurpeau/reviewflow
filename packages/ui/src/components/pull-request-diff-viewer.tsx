import type {
  DiffLineAnnotation,
  FileDiffContentsLoader,
  FileDiffMetadata,
  SelectedLineRange,
} from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import type {
  DiffFileImpacts,
  DiffGroup,
  DiffImpactsResponse,
  DiffReadingOrderResponse,
  DiffWhitespace,
  PullRequestDiffResponse,
  PullRequestFile,
  PullRequestFileViewed,
  PullRequestRef,
  PullRequestThread,
} from "@reviewflow/sdk";
import {
  AccentScope,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Icon,
  IconButton,
  Popover,
  PressableBox,
  Text,
  View,
} from "alouette";
import { CaretDownRegularIcon } from "alouette-icons/phosphor-icons/CaretDown";
import { CaretRightRegularIcon } from "alouette-icons/phosphor-icons/CaretRight";
import { ShareNetworkRegularIcon } from "alouette-icons/phosphor-icons/ShareNetwork";
import type { ComponentRef, ReactNode } from "react";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PullRequestDataSource } from "../dataSource.ts";
import { usePullRequestDataSource } from "../dataSource.ts";
import type { PendingComment } from "../services/PullRequestReviewDraftProvider.tsx";
import { usePullRequestReviewDraft } from "../services/PullRequestReviewDraftProvider.tsx";
import type { DiffTheme } from "./branch-diff/diff-themes.ts";
import { diffThemeNames } from "./branch-diff/diff-themes.ts";
// metro picks the .web.tsx variant only for a specifier without extension
/* eslint-disable-next-line import-x/no-unresolved */ // oxlint-disable-next-line import/extensions
import { DiffWorkerPool } from "./branch-diff/diff-worker-pool";
import type { CommitFileAnchoring } from "./pull-request-commit-files.ts";
import type {
  AnnotationGroup,
  AnnotationItem,
  EditPullRequest,
  ReviewDraftActions,
} from "./pull-request-diff-annotations.tsx";
import {
  ComposerAnnotation,
  PendingAnnotation,
  ThreadAnnotation,
} from "./pull-request-diff-annotations.tsx";
import type { PullRequestCollapse } from "./pull-request-diff-collapse.ts";
import type { PullRequestMovedOn } from "./pull-request-diff-data.ts";
import {
  countImpacts,
  maxImporterNames,
  pluralOf,
  usageLabel,
} from "./pull-request-diff-impacts.ts";
import type { DiffFileHighlight } from "./pull-request-diff-jump.ts";
import {
  useDiffFileElements,
  useDiffFileHighlight,
} from "./pull-request-diff-jump.ts";
import type { Composer } from "./pull-request-diff-lines.ts";
import {
  anchorOfRange,
  annotationSideOf,
  isLineInPatch,
  rightSideLines,
} from "./pull-request-diff-lines.ts";
import { revealTopOf } from "./scroll-parent.ts";

export type DiffStyle = "split" | "unified";

const fileKeyOf = (file: FileDiffMetadata): string => file.name;

interface FileReview {
  viewed: PullRequestFileViewed;
  onViewed: (viewed: boolean) => void;
  threads: PullRequestThread[];
  outdated: PullRequestThread[];
  /** on lines changed since the diff's head: listed, not placed */
  changedSince: PullRequestThread[];
  /** on lines the patch does not carry once whitespace is hidden: listed, not placed */
  hiddenThreads: PullRequestThread[];
  hiddenPending: PendingComment[];
  /** changed since the diff's head: a mark would be set on a version not shown */
  viewedLocked: boolean;
  pending: PendingComment[];
  commentable: boolean;
  /** the base of this diff is not the pull request's: only the new side's line numbers mean the same */
  rightOnly: boolean;
  /** the commit a new comment is anchored on */
  commitId: string;
  /** false on a single commit: no viewed mark, no pending review */
  ofPullRequest: boolean;
  /** false on the viewer's own pull request: no review to start */
  reviewable: boolean;
  /** on a commit read in its order; null otherwise */
  anchoring: CommitFileAnchoring | null;
  composer: Composer | null;
  onOpenComposer: (composer: Composer) => void;
  onCloseComposer: () => void;
  onEdit: EditPullRequest;
  draft: ReviewDraftActions;
}

const buildAnnotations = (
  file: FileDiffMetadata,
  review: FileReview | undefined,
): DiffLineAnnotation<AnnotationGroup>[] => {
  if (review === undefined) return [];
  const groups = new Map<string, DiffLineAnnotation<AnnotationGroup>>();
  const place = (
    side: "LEFT" | "RIGHT",
    lineNumber: number,
    item: AnnotationItem,
  ): void => {
    const annotationSide = annotationSideOf(side);
    const key = `${annotationSide}:${String(lineNumber)}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        side: annotationSide,
        lineNumber,
        metadata: { items: [item] },
      });
    } else {
      existing.metadata.items.push(item);
    }
  };

  for (const thread of review.threads) {
    if (thread.line !== null) {
      place(thread.side, thread.line, { kind: "thread", thread });
    }
  }
  for (const comment of review.pending) {
    place(comment.side, comment.line, { kind: "pending", comment });
  }
  const { composer } = review;
  if (composer?.fileKey === fileKeyOf(file)) {
    place(composer.anchor.side, composer.anchor.line, {
      kind: "composer",
      anchor: composer.anchor,
      suggestionLines: rightSideLines(file, composer.anchor),
    });
  }
  return [...groups.values()];
};

const sameItem = (
  a: AnnotationItem,
  b: AnnotationItem | undefined,
): boolean => {
  if (a.kind === "thread") return b?.kind === "thread" && a.thread === b.thread;
  if (a.kind === "pending") {
    return b?.kind === "pending" && a.comment === b.comment;
  }
  return b?.kind === "composer" && a.anchor === b.anchor;
};

const sameAnnotations = (
  a: readonly DiffLineAnnotation<AnnotationGroup>[],
  b: readonly DiffLineAnnotation<AnnotationGroup>[],
): boolean =>
  a.length === b.length &&
  a.every((group, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      group.side === other.side &&
      group.lineNumber === other.lineNumber &&
      group.metadata.items.length === other.metadata.items.length &&
      group.metadata.items.every((item, itemIndex) =>
        sameItem(item, other.metadata.items[itemIndex]),
      )
    );
  });

/**
 * The previous annotations while they place the same threads, comments and
 * composer: the per-file review is rebuilt at every render of the files, and
 * pierre redraws a whole file for an annotations array it has not seen.
 */
const useStableAnnotations = (
  file: FileDiffMetadata,
  next: DiffLineAnnotation<AnnotationGroup>[],
): DiffLineAnnotation<AnnotationGroup>[] => {
  const [stable, setStable] = useState({ file, annotations: next });
  const reused =
    stable.file === file && sameAnnotations(stable.annotations, next);
  if (!reused) setStable({ file, annotations: next });
  return reused ? stable.annotations : next;
};

/** Why a thread is listed above its file rather than placed on a line. */
type UnplacedKind = "changedSince" | "outdated" | "whitespace";

const commentsText = (count: number): string =>
  `${String(count)} comment${count === 1 ? "" : "s"}`;

const unplacedLabel = (kind: UnplacedKind, count: number): string => {
  if (kind === "changedSince") {
    return `${commentsText(count)} on code changed since your review started`;
  }
  if (kind === "whitespace") {
    return `${commentsText(count)} on lines hidden with whitespace changes`;
  }
  return `${String(count)} outdated comment${count === 1 ? "" : "s"}`;
};

const unplacedLineText = (
  kind: UnplacedKind,
  { path, line, originalLine }: PullRequestThread,
): string => {
  if (kind === "changedSince" && line !== null) {
    return `On line ${String(line)} of the latest version`;
  }
  if (kind === "whitespace" && line !== null) {
    return `On line ${String(line)} of ${path}`;
  }
  if (originalLine === null) return "Line no longer in the diff";
  return `Was on line ${String(originalLine)}`;
};

interface UnplacedThreadsProps {
  kind: UnplacedKind;
  threads: PullRequestThread[];
  onEdit: EditPullRequest;
}

function UnplacedThreads({
  kind,
  threads,
  onEdit,
}: UnplacedThreadsProps): ReactNode {
  const [open, setOpen] = useState(false);
  if (threads.length === 0) return null;
  const count = threads.reduce(
    (total, thread) => total + thread.commentsTotal,
    0,
  );
  return (
    <View className="gap-xs">
      <View className="flex-row items-center gap-xs">
        <Button
          size="sm"
          accent="neutral"
          variant="soft"
          text={unplacedLabel(kind, count)}
          onPress={() => {
            setOpen(!open);
          }}
        />
      </View>
      {open
        ? threads.map((thread) => (
            <View key={thread.id} className="gap-xxs">
              <Text className="text-xs text-muted">
                {unplacedLineText(kind, thread)}
              </Text>
              <ThreadAnnotation thread={thread} onEdit={onEdit} />
            </View>
          ))
        : null}
    </View>
  );
}

interface HiddenByWhitespaceProps {
  threads: PullRequestThread[];
  pending: PendingComment[];
  onEdit: EditPullRequest;
  draft: ReviewDraftActions;
}

/**
 * What hiding whitespace took the line of. A pending comment is always open:
 * it goes out with the review, so it is never out of sight.
 */
function HiddenByWhitespace({
  threads,
  pending,
  onEdit,
  draft,
}: HiddenByWhitespaceProps): ReactNode {
  return (
    <>
      <UnplacedThreads kind="whitespace" threads={threads} onEdit={onEdit} />
      {pending.map((comment) => (
        <View key={comment.key} className="gap-xxs">
          <Text className="text-xs text-muted">
            {`Pending, on line ${String(comment.line)} of ${comment.path}, hidden with whitespace changes`}
          </Text>
          <PendingAnnotation comment={comment} draft={draft} />
        </View>
      ))}
    </>
  );
}

interface ViewedBadgeProps {
  viewed: PullRequestFileViewed;
  locked: boolean;
}

/** Also says why the viewed checkbox is disabled, which alouette's Checkbox cannot. */
interface HeaderBadgeProps {
  accent: "info" | "warning";
  children: string;
}

/** Wrapped: a Badge aligns itself to the start, so its own box is what the header row centers. */
function HeaderBadge({ accent, children }: HeaderBadgeProps): ReactNode {
  return (
    <View>
      <Badge accent={accent} size="sm">
        {children}
      </Badge>
    </View>
  );
}

/** Why a file of a commit read in its order has fewer review gestures. */
function AnchoringBadge({
  anchoring,
}: {
  anchoring: CommitFileAnchoring | null;
}): ReactNode {
  if (anchoring === "commit") {
    return (
      <HeaderBadge accent="info">Changed again in a later commit</HeaderBadge>
    );
  }
  if (anchoring === "head") {
    return (
      <HeaderBadge accent="info">Also changed in an earlier commit</HeaderBadge>
    );
  }
  return null;
}

function ViewedBadge({ viewed, locked }: ViewedBadgeProps): ReactNode {
  if (locked) {
    return (
      <HeaderBadge accent="warning">
        Changed since your review started
      </HeaderBadge>
    );
  }
  if (viewed === "dismissed") {
    return <HeaderBadge accent="warning">Changed since viewed</HeaderBadge>;
  }
  return null;
}

type DiffSides = NonNullable<PullRequestDiffResponse["sides"]>;

/**
 * What lets pierre unfold the unchanged lines between hunks: a patch carries
 * only its hunks, and the whole of both sides is read on the first unfold.
 */
const fileLoaderOf =
  (
    ref: PullRequestRef,
    sides: DiffSides,
    readFileAtSha: PullRequestDataSource["readFileAtSha"],
  ): FileDiffContentsLoader =>
  async (file) => {
    const oldName = file.prevName ?? file.name;
    const [oldContents, newContents] = await Promise.all([
      file.type === "rename-pure"
        ? null
        : readFileAtSha(ref, sides.old, oldName),
      readFileAtSha(ref, sides.new, file.name),
    ]);
    const newFile = { name: file.name, contents: newContents };
    if (oldContents === null) return { oldFile: null, newFile };
    return { oldFile: { name: oldName, contents: oldContents }, newFile };
  };

/** Pierre's own rule pins a file header at `top: 0`, under the diff's toolbar. */
const stickyHeaderBelow = (top: number): string =>
  `[data-diffs-header][data-sticky] { top: ${String(top)}px; }`;

/**
 * alouette's global scrollbar-width and scrollbar-color are inherited through
 * the shadow root, and a browser then ignores pierre's ::-webkit-scrollbar
 * rules: the vertical gutter pierre zeroes would show as a strip beside the
 * code, the horizontal one as alouette's opaque track under it. Firefox has no
 * such rules and gets pierre's own scrollbar-color, so it is left alone.
 */
/** The caret lined up with the unfold buttons below it, inset as pierre insets its separators. */
const headerInset =
  "[data-diffs-header=default] { padding-inline: var(--diffs-gap-inline, var(--diffs-gap-fallback)); }";

/**
 * alouette's `shadow-s`, the one its surfaces carry: Tailwind inlines
 * `--shadow-s` into the utility, so only its colors exist as variables here.
 */
const surfaceShadow =
  "inset 0 1px 2px var(--color-shadow-highlight, #ffffff40), 0 1px 2px var(--color-dark-shadow, #00000040), 0 2px 4px var(--color-soft-shadow, #00000025)";

/** alouette's `rounded-sm`, the radius of its cards (`surface`). */
const fileRadius = "1rem";

/**
 * Rounded and raised as an alouette card. `clip` rather than `hidden`: it
 * makes no scroll container, which would stop the header sticking under the
 * toolbar.
 */
const roundedFile = `:host { border-radius: ${fileRadius}; overflow: clip; box-shadow: ${surfaceShadow}; }`;

const pierreScrollbars =
  "@supports not (-moz-appearance: none) { [data-code] { scrollbar-width: auto; scrollbar-color: auto; } }";

/**
 * Closing a file read down to its end would leave the reader on the files
 * after it, some of them never seen: its top is brought back under the
 * toolbar. Done before closing, since a file's top does not move when it
 * closes, so it does not depend on when pierre applies the change.
 */
const revealFileTop = (file: HTMLElement | null, stickyTop: number): void => {
  if (file !== null) revealTopOf(file, stickyTop);
};

interface DiffFileProps {
  file: FileDiffMetadata;
  diffStyle: DiffStyle;
  theme: DiffTheme;
  themeType: "dark" | "light";
  wordWrap: boolean;
  stickyTop: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  loadFiles: FileDiffContentsLoader | undefined;
  /** where the reading order starts a flow */
  entry: boolean;
  /** absent: not analyzed, or no touched export used outside the diff */
  impacts?: DiffFileImpacts;
  review?: FileReview;
}

interface FileImpactsListProps {
  impacts: DiffFileImpacts;
}

/**
 * Each touched export of the file and the files outside the diff that use it;
 * past `maxImporterNames` files in all, each export's counts only.
 */
function FileImpactsList({ impacts }: FileImpactsListProps): ReactNode {
  const counts = countImpacts([impacts]);
  const showNames = counts.files + counts.tests <= maxImporterNames;
  return (
    <View className="gap-sm p-xs">
      <Text className="font-body-bold text-sm text-sharp">
        {`${pluralOf(counts.exports, "touched export")} used outside the diff`}
      </Text>
      <View className="gap-sm">
        {impacts.exports.map((impact) => (
          <View key={impact.name} className="gap-xxs">
            <View className="flex-row flex-wrap items-center gap-xs">
              <Code className="text-sm">{impact.name}</Code>
              {impact.removed ? (
                <Badge size="sm" accent="warning">
                  removed
                </Badge>
              ) : null}
              {showNames ? null : (
                <Text className="text-xs text-muted">
                  {`used in ${usageLabel(countImpacts([{ path: impacts.path, exports: [impact] }]))}`}
                </Text>
              )}
            </View>
            {showNames
              ? impact.importers.map(({ path, test }) => (
                  <Text key={path} className="pl-m text-xs">
                    {path}
                    {test ? (
                      <Text className="text-xs text-muted"> · test</Text>
                    ) : null}
                  </Text>
                ))
              : null}
          </View>
        ))}
        {showNames ? null : (
          <Text className="text-xs text-muted">
            {`Files are left out past ${String(maxImporterNames)}.`}
          </Text>
        )}
      </View>
    </View>
  );
}

interface FileHeaderMetadataProps {
  entry: boolean;
  /** what the touched exports of the file are used by; undefined: none known, or none touched */
  impacts: DiffFileImpacts | undefined;
  review: FileReview | undefined;
  onViewedPress: (viewed: boolean) => void;
}

/**
 * The header's "Used in" count, opening the touched exports and their users:
 * pierre has no slot between the header and the diff, and above or below the
 * file it reads as another file's.
 */
function FileImpactsButton({
  impacts,
}: {
  impacts: DiffFileImpacts;
}): ReactNode {
  const anchorRef = useRef<ComponentRef<typeof View>>(null);
  const [open, setOpen] = useState(false);
  const counts = countImpacts([impacts]);
  return (
    <>
      <View ref={anchorRef}>
        <PressableBox
          variant="soft"
          accent="info"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex-row items-center gap-xxs rounded-full border border-border-muted px-xs py-xxs"
          onPress={() => {
            setOpen(!open);
          }}
        >
          <AccentScope accent="info">
            <Icon
              icon={<ShareNetworkRegularIcon />}
              size={12}
              className="text-accent"
            />
            <Text className="font-body-bold text-xs text-accent">
              {`Used in ${usageLabel(counts)}`}
            </Text>
          </AccentScope>
        </PressableBox>
      </View>
      <Popover
        open={open}
        anchorRef={anchorRef}
        align="end"
        width="content"
        aria-label={`Users of ${impacts.path}`}
        onClose={() => {
          setOpen(false);
        }}
      >
        {/* Popover takes no offset: the gap keeps the panel off the badge */}
        <View className="pt-xs">
          <Box className="surface-popover max-h-[60vh] max-w-[640px] overflow-y-auto">
            <FileImpactsList impacts={impacts} />
          </Box>
        </View>
      </Popover>
    </>
  );
}

function FileHeaderMetadata({
  entry,
  impacts,
  review,
  onViewedPress,
}: FileHeaderMetadataProps): ReactNode {
  return (
    <View className="flex-row items-center gap-xs">
      {entry ? <HeaderBadge accent="info">Entry point</HeaderBadge> : null}
      {impacts === undefined ? null : <FileImpactsButton impacts={impacts} />}
      {impacts?.exports.some(({ removed }) => removed) === true ? (
        <HeaderBadge accent="warning">Removed export</HeaderBadge>
      ) : null}
      <AnchoringBadge anchoring={review?.anchoring ?? null} />
      {review?.ofPullRequest === true ? (
        <>
          <ViewedBadge viewed={review.viewed} locked={review.viewedLocked} />
          <Checkbox
            label="Viewed"
            checked={review.viewed === "viewed"}
            disabled={review.viewedLocked}
            onValueChange={onViewedPress}
          />
        </>
      ) : null}
    </View>
  );
}

/**
 * The header of the file the reader just went to from the overview, outlined
 * and tinted so the eye finds it, open or closed, then faded. The header only:
 * an outline over the whole file would recolor the diff's change bars. Inset
 * shadows, since they paint over pierre's opaque sticky ground and can
 * transition, where a background image cannot.
 */
const headerHighlight = (
  highlight: DiffFileHighlight | null,
  collapsed: boolean,
): string => {
  if (highlight === null) return "";
  const shadows =
    highlight.phase === "shown"
      ? `inset 0 0 0 2px ${highlight.color}, inset 0 0 0 999px color-mix(in srgb, ${highlight.color} 14%, transparent)`
      : "inset 0 0 0 2px transparent, inset 0 0 0 999px transparent";
  // the file's own rounding (`roundedFile`): the whole file when closed, its top when open
  const radius = collapsed ? fileRadius : `${fileRadius} ${fileRadius} 0 0`;
  return `[data-diffs-header] { border-radius: ${radius}; box-shadow: ${shadows}; transition: box-shadow var(--motion-duration-collapse) ease-out; }`;
};

function DiffFile({
  file,
  diffStyle,
  theme,
  themeType,
  wordWrap,
  stickyTop,
  collapsed,
  onToggleCollapsed,
  loadFiles,
  entry,
  impacts,
  review,
}: DiffFileProps): ReactNode {
  const fileKey = fileKeyOf(file);
  const lineAnnotations = useStableAnnotations(
    file,
    buildAnnotations(file, review),
  );
  const commentable = review?.commentable === true;
  // pierre compares its options with ===: a handler made at each render would
  // redraw the file every time
  const openComposerAt = useRef<(range: SelectedLineRange) => void>(() => {});
  useLayoutEffect(() => {
    openComposerAt.current = (range) => {
      if (review === undefined) return;
      const anchor = anchorOfRange(file.name, range);
      const touchesOldSide =
        anchor.side === "LEFT" || anchor.startSide === "LEFT";
      if (review.rightOnly && touchesOldSide) return;
      review.onOpenComposer({ fileKey, anchor, range });
    };
  });
  const onGutterUtilityClick = useCallback((range: SelectedLineRange) => {
    openComposerAt.current(range);
  }, []);
  const fileRef = useRef<ComponentRef<typeof View>>(null);
  const fileElements = useDiffFileElements();
  const highlight = useDiffFileHighlight(fileKey);
  const setFileRef = useCallback(
    (node: ComponentRef<typeof View>) => {
      fileRef.current = node;
      const unregister = fileElements?.register(
        fileKey,
        node as unknown as HTMLElement,
      );
      return () => {
        fileRef.current = null;
        unregister?.();
      };
    },
    [fileElements, fileKey],
  );
  const revealBeforeClosing = (): void => {
    if (collapsed) return;
    revealFileTop(fileRef.current as unknown as HTMLElement | null, stickyTop);
  };

  return (
    <View ref={setFileRef} className="gap-xs">
      {review === undefined ? null : (
        <>
          <UnplacedThreads
            kind="outdated"
            threads={review.outdated}
            onEdit={review.onEdit}
          />
          <UnplacedThreads
            kind="changedSince"
            threads={review.changedSince}
            onEdit={review.onEdit}
          />
          <HiddenByWhitespace
            threads={review.hiddenThreads}
            pending={review.hiddenPending}
            draft={review.draft}
            onEdit={review.onEdit}
          />
        </>
      )}
      <FileDiff<AnnotationGroup>
        fileDiff={file}
        lineAnnotations={lineAnnotations}
        selectedLines={
          review?.composer?.fileKey === fileKey ? review.composer.range : null
        }
        options={{
          diffStyle,
          theme: diffThemeNames(theme),
          themeType,
          overflow: wordWrap ? "wrap" : "scroll",
          collapsed,
          stickyHeader: true,
          unsafeCSS: `${stickyHeaderBelow(stickyTop)} ${headerInset} ${roundedFile} ${pierreScrollbars} ${headerHighlight(highlight, collapsed)}`,
          loadDiffFiles: loadFiles,
          enableGutterUtility: commentable,
          onGutterUtilityClick: commentable ? onGutterUtilityClick : undefined,
        }}
        renderHeaderPrefix={() => (
          <IconButton
            icon={
              collapsed ? <CaretRightRegularIcon /> : <CaretDownRegularIcon />
            }
            size="sm"
            variant="soft"
            accent="neutral"
            aria-label={collapsed ? `Open ${file.name}` : `Close ${file.name}`}
            aria-expanded={!collapsed}
            onPress={() => {
              revealBeforeClosing();
              onToggleCollapsed();
            }}
          />
        )}
        renderHeaderMetadata={
          !entry &&
          impacts === undefined &&
          review?.ofPullRequest !== true &&
          (review?.anchoring ?? null) === null
            ? undefined
            : () => (
                <FileHeaderMetadata
                  entry={entry}
                  impacts={impacts}
                  review={review}
                  onViewedPress={(viewed) => {
                    if (viewed) revealBeforeClosing();
                    review?.onViewed(viewed);
                  }}
                />
              )
        }
        renderAnnotation={({ metadata }) => (
          <View>
            {metadata.items.map((item) => {
              if (review === undefined) return null;
              if (item.kind === "thread") {
                return (
                  <ThreadAnnotation
                    key={item.thread.id}
                    thread={item.thread}
                    onEdit={review.onEdit}
                  />
                );
              }
              if (item.kind === "pending") {
                return (
                  <PendingAnnotation
                    key={item.comment.key}
                    comment={item.comment}
                    draft={review.draft}
                  />
                );
              }
              return (
                <ComposerAnnotation
                  key="composer"
                  anchor={item.anchor}
                  suggestionLines={item.suggestionLines}
                  commitId={review.commitId}
                  draft={
                    review.ofPullRequest && review.reviewable
                      ? review.draft
                      : null
                  }
                  onEdit={review.onEdit}
                  onClose={review.onCloseComposer}
                />
              );
            })}
          </View>
        )}
      />
    </View>
  );
}

interface FileItem {
  file: FileDiffMetadata;
  entry: boolean;
  /** its tests and stories, read below it and closed until opened */
  attached: FileDiffMetadata[];
}

interface FileGroup {
  name: string;
  items: FileItem[];
}

/** How a file is shown: `attached` below the file it covers. */
interface FilePlacement {
  entry: boolean;
  attached: boolean;
}

const plainItem = (file: FileDiffMetadata): FileItem => ({
  file,
  entry: false,
  attached: [],
});

/** The daemon's groups, in its order; a file it did not group goes under the root. */
const groupFiles = (
  files: FileDiffMetadata[],
  groups: DiffGroup[],
): FileGroup[] => {
  const groupOf = new Map<string, string>();
  for (const { name, paths } of groups) {
    for (const path of paths) groupOf.set(path, name);
  }
  const grouped = new Map<string, FileDiffMetadata[]>(
    groups.map(({ name }) => [name, []]),
  );
  for (const file of files) {
    const name = groupOf.get(file.name) ?? "";
    const group = grouped.get(name);
    if (group === undefined) grouped.set(name, [file]);
    else group.push(file);
  }
  return [...grouped]
    .filter(([, groupFilesList]) => groupFilesList.length > 0)
    .map(([name, groupFilesList]) => ({
      name,
      items: groupFilesList.map(plainItem),
    }));
};

/**
 * The reading order's groups and files; a file of the patch it does not name
 * (read on another range) goes after them, in its package's group.
 */
const orderFiles = (
  files: FileDiffMetadata[],
  groups: DiffGroup[],
  readingOrder: DiffReadingOrderResponse,
): FileGroup[] => {
  const byName = new Map(files.map((file) => [file.name, file]));
  const placed = new Set<string>();
  const take = (path: string): FileDiffMetadata[] => {
    const file = byName.get(path);
    if (file === undefined || placed.has(path)) return [];
    placed.add(path);
    return [file];
  };
  const ordered: FileGroup[] = readingOrder.groups.map(
    ({ name, files: paths }) => ({
      name,
      items: paths.flatMap(({ path, entry, attached }) =>
        take(path).map((file) => ({
          file,
          entry,
          attached: attached.flatMap(take),
        })),
      ),
    }),
  );
  for (const rest of groupFiles(
    files.filter((file) => !placed.has(file.name)),
    groups,
  )) {
    const group = ordered.find(({ name }) => name === rest.name);
    if (group === undefined) ordered.push(rest);
    else group.items.push(...rest.items);
  }
  return ordered.filter(({ items }) => items.length > 0);
};

const filesOf = ({ file, attached }: FileItem): FileDiffMetadata[] => [
  file,
  ...attached,
];

interface FileGroupsProps {
  groups: FileGroup[];
  renderFile: (file: FileDiffMetadata, placement: FilePlacement) => ReactNode;
}

function FileGroups({ groups, renderFile }: FileGroupsProps): ReactNode {
  return (
    <View className="gap-xxl">
      {groups.map((group) => {
        const count = group.items.flatMap(filesOf).length;
        return (
          <View key={group.name} className="gap-sm">
            <View className="flex-row items-baseline gap-sm">
              <Text
                role="heading"
                aria-level={2}
                className="font-heading-bold text-xl"
              >
                {group.name === "" ? "Root" : group.name}
              </Text>
              <Text className="text-sm text-muted">
                {count === 1
                  ? "1 changed file"
                  : `${String(count)} changed files`}
              </Text>
            </View>
            <View className="gap-m">
              {group.items.map(({ file, entry, attached }) => (
                <View key={fileKeyOf(file)} className="gap-xs">
                  {renderFile(file, { entry, attached: false })}
                  {attached.length === 0 ? null : (
                    <View className="ml-l gap-xs">
                      {attached.map((test) => (
                        <View key={fileKeyOf(test)}>
                          {renderFile(test, { entry: false, attached: true })}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export interface PullRequestDiffReview {
  /** the head a comment is anchored on: the diff's, not the header's last read */
  headSha: string;
  /** the pull request's threads on the code, null while they are read */
  threads: PullRequestThread[] | null;
  /** the files with the viewer's viewed marks, null while they are read */
  files: PullRequestFile[] | null;
  /** the diff's head is the pull request's: a comment can be anchored on it */
  commentable: boolean;
  rightOnly: boolean;
  /**
   * Set on one commit's own diff: comments are anchored on it, alone (a
   * review is sent on the head), on the new side only; the pull request's
   * threads, pending comments and viewed marks are not shown.
   */
  commitOid?: string;
  /**
   * Set on one commit of the pull request read in its order: each of its
   * paths with how its lines relate to the pull request's diff. A file is
   * reviewed as on `commitOid`'s diff, on the new side only, or as on the
   * pull request's diff.
   */
  commitFiles?: {
    oid: string;
    anchorings: ReadonlyMap<string, CommitFileAnchoring>;
  };
  /**
   * false on the viewer's own pull request: GitHub lets its author comment
   * but not approve or request changes, so a comment goes out alone and there
   * is no review to start. Unset, reviewable.
   */
  reviewable?: boolean;
  /** set while the diff shows a range the pull request has left */
  movedOn?: PullRequestMovedOn | null;
  onEdit: EditPullRequest;
  /** resolves once GitHub answered and the screen read again; never rejects */
  onViewed: (path: string, viewed: boolean) => Promise<void>;
}

const changedSinceShown = (
  movedOn: PullRequestMovedOn | null | undefined,
  path: string,
): boolean =>
  movedOn != null && (movedOn.paths === null || movedOn.paths.has(path));

/** Its line, read on the pull request's range, may name other code here. */
const isDisplaced = (
  movedOn: PullRequestMovedOn | null | undefined,
  thread: PullRequestThread,
): boolean =>
  changedSinceShown(movedOn, thread.path) ||
  (movedOn?.baseMoved === true && thread.side === "LEFT");

const viewedStateOf = (
  pressed: boolean | undefined,
  known: PullRequestFileViewed | undefined,
): PullRequestFileViewed => {
  if (pressed === undefined) return known ?? "unviewed";
  return pressed ? "viewed" : "unviewed";
};

interface ReviewedFilesProps {
  groups: FileGroup[];
  review: PullRequestDiffReview;
  whitespace: DiffWhitespace;
  diffStyle: DiffStyle;
  theme: DiffTheme;
  themeType: "dark" | "light";
  wordWrap: boolean;
  stickyTop: number;
  collapse: PullRequestCollapse;
  loadFiles: FileDiffContentsLoader | undefined;
  impactsOf: (path: string) => DiffFileImpacts | undefined;
  commitComposer: Composer | null;
  onCommitComposerChange: (composer: Composer | null) => void;
}

function ReviewedFiles({
  groups,
  review,
  whitespace,
  diffStyle,
  theme,
  themeType,
  wordWrap,
  stickyTop,
  collapse,
  loadFiles,
  impactsOf,
  commitComposer,
  onCommitComposerChange,
}: ReviewedFilesProps): ReactNode {
  const draft = usePullRequestReviewDraft();
  const anchoringOf = (path: string): CommitFileAnchoring => {
    if (review.commitOid !== undefined) return "commit";
    if (review.commitFiles === undefined) return "pullRequest";
    return review.commitFiles.anchorings.get(path) ?? "commit";
  };
  const isOfPullRequest = (path: string): boolean =>
    anchoringOf(path) !== "commit";
  const isRightOnly = (path: string): boolean =>
    review.rightOnly || anchoringOf(path) !== "pullRequest";
  const openComposerOf =
    (ofPullRequest: boolean) =>
    (next: Composer): void => {
      if (ofPullRequest) {
        onCommitComposerChange(null);
        draft.openComposer(next);
        return;
      }
      // one comment written at a time on a commit read in its order
      if (review.commitFiles !== undefined) draft.closeComposer();
      onCommitComposerChange(next);
    };
  const closeComposerOf = (ofPullRequest: boolean) =>
    ofPullRequest
      ? draft.closeComposer
      : () => {
          onCommitComposerChange(null);
        };
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const threads = review.threads ?? [];
  const viewedOf = new Map(
    (review.files ?? []).map(({ path, viewed }) => [path, viewed]),
  );

  const draftActions: ReviewDraftActions = {
    hasPending: draft.comments.length > 0,
    add: draft.add,
    update: draft.update,
    remove: draft.remove,
  };

  const onSide = ({
    path,
    side,
  }: {
    path: string;
    side: "LEFT" | "RIGHT";
  }): boolean => !isRightOnly(path) || side === "RIGHT";
  const pendingOfPullRequest = draft.comments.filter(
    (comment) => isOfPullRequest(comment.path) && onSide(comment),
  );
  /**
   * `git diff -w` drops a file whose every change is whitespace, so what is
   * anchored in it has no file to be listed above.
   */
  const shownPaths = new Set(
    groups.flatMap(({ items }) =>
      items.flatMap(filesOf).map(({ name }) => name),
    ),
  );
  const inHiddenFile = ({ path }: { path: string }): boolean =>
    whitespace === "hide" && !shownPaths.has(path);
  const isHiddenLine = (
    file: FileDiffMetadata,
    { side, line }: { side: "LEFT" | "RIGHT"; line: number | null },
  ): boolean =>
    whitespace === "hide" && line !== null && !isLineInPatch(file, side, line);

  const markViewed = (path: string, viewed: boolean): void => {
    collapse.set(path, viewed);
    setOptimistic((previous) => ({ ...previous, [path]: viewed }));
    review
      .onViewed(path, viewed)
      .then(() => {
        setOptimistic((previous) => {
          const { [path]: _settled, ...rest } = previous;
          return rest;
        });
      })
      .catch(() => {
        // onViewed reports its own failure and does not reject
      });
  };

  return (
    <View className="gap-m">
      <HiddenByWhitespace
        threads={threads.filter(
          (thread) =>
            isOfPullRequest(thread.path) &&
            !thread.outdated &&
            thread.line !== null &&
            onSide(thread) &&
            inHiddenFile(thread),
        )}
        pending={pendingOfPullRequest.filter(inHiddenFile)}
        draft={draftActions}
        onEdit={review.onEdit}
      />
      <FileGroups
        groups={groups}
        renderFile={(file, { entry, attached }) => {
          const path = file.name;
          const anchoring = anchoringOf(path);
          const ofPullRequest = anchoring !== "commit";
          const rightOnly = isRightOnly(path);
          const pressed = optimistic[path];
          const viewed = ofPullRequest
            ? viewedStateOf(pressed, viewedOf.get(path))
            : "unviewed";
          const closedByDefault = attached || viewed === "viewed";
          const ofFile = threads.filter((thread) => thread.path === path);
          const onLine = ofFile.filter(
            (thread) =>
              ofPullRequest &&
              !thread.outdated &&
              thread.line !== null &&
              onSide(thread),
          );
          const settled = onLine.filter(
            (thread) => !isDisplaced(review.movedOn, thread),
          );
          const pendingOfFile = pendingOfPullRequest.filter(
            (comment) => comment.path === path,
          );
          return (
            <DiffFile
              file={file}
              diffStyle={diffStyle}
              theme={theme}
              themeType={themeType}
              wordWrap={wordWrap}
              stickyTop={stickyTop}
              loadFiles={loadFiles}
              entry={entry}
              impacts={impactsOf(path)}
              collapsed={collapse.isCollapsed(path, closedByDefault)}
              review={{
                viewed,
                onViewed: (next) => {
                  markViewed(path, next);
                },
                threads: settled.filter(
                  (thread) => !isHiddenLine(file, thread),
                ),
                outdated: rightOnly
                  ? []
                  : ofFile.filter((thread) => thread.outdated),
                changedSince: onLine.filter((thread) =>
                  isDisplaced(review.movedOn, thread),
                ),
                hiddenThreads: settled.filter((thread) =>
                  isHiddenLine(file, thread),
                ),
                hiddenPending: pendingOfFile.filter((comment) =>
                  isHiddenLine(file, comment),
                ),
                viewedLocked:
                  ofPullRequest && changedSinceShown(review.movedOn, path),
                pending: pendingOfFile.filter(
                  (comment) => !isHiddenLine(file, comment),
                ),
                commentable: review.commentable,
                rightOnly,
                commitId: ofPullRequest
                  ? review.headSha
                  : (review.commitOid ??
                    review.commitFiles?.oid ??
                    review.headSha),
                ofPullRequest,
                reviewable: review.reviewable !== false,
                anchoring: review.commitFiles === undefined ? null : anchoring,
                composer: ofPullRequest ? draft.composer : commitComposer,
                onOpenComposer: openComposerOf(ofPullRequest),
                onCloseComposer: closeComposerOf(ofPullRequest),
                onEdit: review.onEdit,
                draft: draftActions,
              }}
              onToggleCollapsed={() => {
                collapse.set(
                  path,
                  !collapse.isCollapsed(path, closedByDefault),
                );
              }}
            />
          );
        }}
      />
    </View>
  );
}

interface PullRequestDiffViewerProps {
  pullRequest: PullRequestRef;
  patch: string;
  groups: DiffGroup[];
  /** null: the files by package, in patch order */
  readingOrder: DiffReadingOrderResponse | null;
  /** null: not read, still reading or failed: no file says anything of its usage */
  impacts: DiffImpactsResponse | null;
  sides: PullRequestDiffResponse["sides"];
  /** what the patch did with whitespace, which decides where a thread can be placed */
  whitespace: DiffWhitespace;
  diffStyle: DiffStyle;
  theme: DiffTheme;
  themeType: "dark" | "light";
  wordWrap: boolean;
  /** where a file header sticks: the height of the toolbar stuck above it */
  stickyTop: number;
  collapse: PullRequestCollapse;
  /** absent: a read-only diff, a commit's own */
  review?: PullRequestDiffReview;
  /** held by the view, whose toolbar must know a comment is being written */
  commitComposer: Composer | null;
  onCommitComposerChange: (composer: Composer | null) => void;
}

/**
 * The only module here importing `@pierre/diffs`, loaded lazily (shiki has no
 * place in the bundle every board loads). A line gets its annotations through
 * `lineAnnotations` (one per side and line, so threads, pending comments and the
 * composer anchored together share it), rendered in light DOM slots by
 * `renderAnnotation`. Commenting starts from pierre's gutter utility, whose
 * drag selects a range: `onGutterUtilityClick` receives it.
 *
 * Memoized, so a toolbar press that changes none of its props does not render
 * every file again before the press shows.
 */
function PullRequestDiffViewer({
  pullRequest,
  patch,
  groups,
  readingOrder,
  impacts,
  sides,
  whitespace,
  diffStyle,
  theme,
  themeType,
  wordWrap,
  stickyTop,
  collapse,
  review,
  commitComposer,
  onCommitComposerChange,
}: PullRequestDiffViewerProps): ReactNode {
  const files = useMemo(
    () => parsePatchFiles(patch).flatMap((parsed) => parsed.files),
    [patch],
  );
  const fileGroups = useMemo(
    () =>
      readingOrder === null
        ? groupFiles(files, groups)
        : orderFiles(files, groups, readingOrder),
    [files, groups, readingOrder],
  );
  const impactsByPath = useMemo(
    () =>
      new Map(
        impacts === null || impacts.tooLarge
          ? []
          : impacts.files
              .filter(({ exports }) => exports.length > 0)
              .map((file) => [file.path, file]),
      ),
    [impacts],
  );
  const impactsOf = (path: string): DiffFileImpacts | undefined =>
    impactsByPath.get(path);
  const { ownerRepo, number } = pullRequest;
  const { readFileAtSha } = usePullRequestDataSource();
  const loadFiles = useMemo(
    () =>
      sides === null
        ? undefined
        : fileLoaderOf({ ownerRepo, number }, sides, readFileAtSha),
    [ownerRepo, number, sides, readFileAtSha],
  );

  return (
    <DiffWorkerPool theme={theme}>
      {review === undefined ? (
        <FileGroups
          groups={fileGroups}
          renderFile={(file, { entry, attached }) => (
            <DiffFile
              file={file}
              diffStyle={diffStyle}
              theme={theme}
              themeType={themeType}
              wordWrap={wordWrap}
              stickyTop={stickyTop}
              loadFiles={loadFiles}
              entry={entry}
              impacts={impactsOf(file.name)}
              collapsed={collapse.isCollapsed(file.name, attached)}
              onToggleCollapsed={() => {
                collapse.set(
                  file.name,
                  !collapse.isCollapsed(file.name, attached),
                );
              }}
            />
          )}
        />
      ) : (
        <ReviewedFiles
          groups={fileGroups}
          review={review}
          whitespace={whitespace}
          diffStyle={diffStyle}
          theme={theme}
          themeType={themeType}
          wordWrap={wordWrap}
          stickyTop={stickyTop}
          collapse={collapse}
          loadFiles={loadFiles}
          impactsOf={impactsOf}
          commitComposer={commitComposer}
          onCommitComposerChange={onCommitComposerChange}
        />
      )}
    </DiffWorkerPool>
  );
}

export default memo(PullRequestDiffViewer);
