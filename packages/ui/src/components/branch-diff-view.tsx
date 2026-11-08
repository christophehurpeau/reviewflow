import type {
  BranchDiffScope,
  CheckoutBranchDiffResponse,
  DiffWhitespace,
} from "@reviewflow/sdk";
import {
  Code,
  IndeterminateCircularProgress,
  IndeterminateLinearProgress,
  ScrollView,
  Tab,
  Tabs,
  Text,
  View,
  WarningMessage,
  useCurrentMode,
} from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { ArrowsInLineVerticalRegularIcon } from "alouette-icons/phosphor-icons/ArrowsInLineVertical";
import { ArrowsOutLineVerticalRegularIcon } from "alouette-icons/phosphor-icons/ArrowsOutLineVertical";
import { ColumnsRegularIcon } from "alouette-icons/phosphor-icons/Columns";
import { RowsRegularIcon } from "alouette-icons/phosphor-icons/Rows";
import type { ReactNode } from "react";
import { Suspense, lazy, useDeferredValue, useState } from "react";
import { useDiffSettings } from "./branch-diff/use-diff-settings.tsx";
import { WhitespaceButton } from "./branch-diff/whitespace-button.tsx";
import { OmittedFiles } from "./omitted-files.tsx";
import type { PullRequestCollapse } from "./pull-request-diff-collapse.ts";
import { usePullRequestCollapse } from "./pull-request-diff-collapse.ts";
import type { DiffStyle } from "./pull-request-diff-viewer.tsx";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";

const DiffViewer = lazy(() => import("./diff-viewer.tsx"));

interface DiffBaseProps<Diff extends CheckoutBranchDiffResponse> {
  diff: Diff;
  baseExtra: ReactNode;
}

/**
 * The base is named with its sha because nothing is fetched before the diff:
 * `origin/main` is as fresh as the last fetch, and this is how it shows.
 */
function DiffBase<Diff extends CheckoutBranchDiffResponse>({
  diff,
  baseExtra,
}: DiffBaseProps<Diff>): ReactNode {
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      {diff.branch === null ? (
        <Text className="text-sm text-muted">detached HEAD</Text>
      ) : (
        <Code className="text-sm">{diff.branch}</Code>
      )}
      <Text className="text-sm text-muted">against</Text>
      <Code className="text-sm">
        {`${diff.base.ref} @ ${diff.base.sha.slice(0, 7)}`}
      </Code>
      {baseExtra}
      {diff.untrackedCount === 0 ? null : (
        <Text className="text-sm text-muted">
          {`${String(diff.untrackedCount)} untracked`}
        </Text>
      )}
    </View>
  );
}

/** The first read, and the viewer's own chunk loading, before any diff shows. */
function DiffLoading(): ReactNode {
  return (
    <View className="items-center py-xl">
      <IndeterminateCircularProgress loading />
    </View>
  );
}

interface DiffBodyProps {
  diff: CheckoutBranchDiffResponse | null;
  error: string | null;
  diffStyle: DiffStyle;
  collapse: PullRequestCollapse;
}

function DiffBody({
  diff,
  error,
  diffStyle,
  collapse,
}: DiffBodyProps): ReactNode {
  const mode = useCurrentMode();
  const { wordWrap, theme, fontFamily } = useDiffSettings();
  if (diff === null) {
    if (error !== null) return <WarningMessage>{error}</WarningMessage>;
    return <DiffLoading />;
  }
  return (
    <View className="gap-m">
      {error === null ? null : <WarningMessage>{error}</WarningMessage>}
      <OmittedFiles omitted={diff.omitted} />
      {diff.patch === "" ? (
        <Text className="text-muted">no changes</Text>
      ) : (
        <Suspense fallback={<DiffLoading />}>
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
        </Suspense>
      )}
    </View>
  );
}

export interface BranchDiffViewProps<Diff extends CheckoutBranchDiffResponse> {
  title: string;
  /** for a dialog's `aria-labelledby` */
  titleId?: string;
  /** the last diff read; null before the first answer */
  diff: Diff | null;
  error: string | null;
  /** a read is running; the diff on screen stays until it answers */
  loading: boolean;
  onReload: () => void;
  scope: BranchDiffScope;
  onScopeChange: (scope: BranchDiffScope) => void;
  whitespace: DiffWhitespace;
  onWhitespaceToggle: () => void;
  /** why the whitespace toggle could not be stored, shown under the toolbar */
  whitespaceError?: string | null;
  /** after the base's ref, e.g. where the base was taken from */
  renderBaseExtra?: (diff: Diff) => ReactNode;
  /** before the title, e.g. a back button */
  headerStart?: ReactNode;
  /** at the toolbar's end, e.g. a close button */
  headerEnd?: ReactNode;
}

/**
 * A checked-out branch against its base: a toolbar, the scope, the base, then
 * the files. It fills its parent, the toolbar fixed and the files scrolling
 * below it, so a dialog and a page both give it a bounded height. Theme, font
 * and word wrap come from `DiffSettingsProvider`; scope and whitespace are the
 * caller's, since they decide what it reads.
 */
export function BranchDiffView<Diff extends CheckoutBranchDiffResponse>({
  title,
  titleId,
  diff,
  error,
  loading,
  onReload,
  scope,
  onScopeChange,
  whitespace,
  onWhitespaceToggle,
  whitespaceError = null,
  renderBaseExtra,
  headerStart,
  headerEnd,
}: BranchDiffViewProps<Diff>): ReactNode {
  const [diffStyle, setDiffStyle] = useState<DiffStyle>("split");
  // the viewer is memoized: a press commits at once, the next patch renders after
  const shownDiff = useDeferredValue(diff);
  const collapse = usePullRequestCollapse();

  return (
    <View className="min-h-0 flex-1">
      <View className="gap-m border-b border-muted p-m">
        <View className="flex-row items-center gap-m">
          {headerStart}
          <Text
            id={titleId}
            role="heading"
            aria-level={1}
            className="min-w-0 flex-1 font-heading-bold text-xl"
          >
            {title}
          </Text>
          <TooltipIconButton
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
          <WhitespaceButton
            whitespace={whitespace}
            onToggle={onWhitespaceToggle}
          />
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
          <TooltipIconButton
            icon={<ArrowsClockwiseRegularIcon />}
            size="sm"
            aria-label="Read the diff again"
            onPress={onReload}
          />
          {headerEnd}
        </View>
        <View className="flex-row flex-wrap items-center gap-m">
          <Tabs
            aria-label="Diff scope"
            value={scope}
            onValueChange={(next) => {
              onScopeChange(next === "committed" ? "committed" : "all");
            }}
          >
            <Tab value="all" label="Branch + uncommitted" />
            <Tab value="committed" label="Commits only" />
          </Tabs>
          {shownDiff === null ? null : (
            <DiffBase
              diff={shownDiff}
              baseExtra={renderBaseExtra?.(shownDiff)}
            />
          )}
        </View>
        {whitespaceError === null ? null : (
          <WarningMessage>{whitespaceError}</WarningMessage>
        )}
      </View>
      {/* the diff on screen stays while the next one is read, so the bar says it is being replaced */}
      <IndeterminateLinearProgress
        loading={loading || shownDiff !== diff}
        size="xs"
      />
      <ScrollView className="flex-1" contentContainerClassName="p-m">
        <DiffBody
          diff={shownDiff}
          error={error}
          diffStyle={diffStyle}
          collapse={collapse}
        />
      </ScrollView>
    </View>
  );
}
