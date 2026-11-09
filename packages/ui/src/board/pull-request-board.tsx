import type {
  BoardFilters,
  PullRequestRef,
  ReviewflowBoardPr,
} from "@reviewflow/sdk";
import {
  buildBoardFilterOptions,
  defaultBoardFilters,
  hasActiveBoardFilters,
  matchesBoardFilters,
} from "@reviewflow/sdk";
import type { Accent, SVGIconElement } from "alouette";
import { EmptyState, IconButton, Text, View, WarningMessage } from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { ConfettiRegularIcon } from "alouette-icons/phosphor-icons/Confetti";
import { FunnelRegularIcon } from "alouette-icons/phosphor-icons/Funnel";
import { PlugsRegularIcon } from "alouette-icons/phosphor-icons/Plugs";
import { TrayRegularIcon } from "alouette-icons/phosphor-icons/Tray";
import type { ReactNode } from "react";
import { useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import { formatDataAge } from "../services/formatDataAge.ts";
import { BoardFiltersBar } from "./board-filters.tsx";
import { BoardBucketSection } from "./bucket-section.tsx";
import { useBoardDataSource } from "./dataSource.ts";
import type { BoardRowInfo } from "./pull-request-row.tsx";

/**
 * Pull requests the app lists under reviewflow's own buckets, in the board's
 * layout and row style: those no bucket carries, or all of them while no
 * reviewflow board is stored. A section without rows is not rendered.
 */
export interface PullRequestBoardExtraSection {
  /** Stable across renders; it is the `bucketKey` {@link BoardRowInfo} reports for the section's rows. */
  key: string;
  title: string;
  rows: ReviewflowBoardPr[];
  /** The title's glyph; a generic pull request glyph without it. */
  icon?: SVGIconElement;
  /** The title's accent; none without it. */
  accent?: Accent;
}

/** The `groupKey` {@link BoardRowInfo} reports for the rows of an extra section. */
export const extraSectionGroupKey = "extra";

/** The `groupKey` {@link BoardRowInfo} reports for the rows of the closed view. */
export const closedSectionGroupKey = "closed";

/** The filters are the app's to keep, in its url for instance. */
export interface PullRequestBoardFiltering {
  value: BoardFilters;
  onChange: (filters: BoardFilters) => void;
}

export interface PullRequestBoardProps {
  /** Pressing a row; the app routes to its pull request screen. */
  onOpenPullRequest: (ref: PullRequestRef) => void;
  /** Shown when no reviewflow token is configured: the app's "connect reviewflow" action. */
  renderConnect?: () => ReactNode;
  /** Extra content under each row's status line, for what an app knows that reviewflow does not. */
  renderRowExtra?: (row: BoardRowInfo) => ReactNode;
  /**
   * Sections rendered after reviewflow's buckets with the same rows, so
   * `renderRowExtra` and `onOpenPullRequest` apply to them. While any has rows,
   * the board shows them instead of its loading, "No board yet" and "Nothing to
   * review" states, so it also renders with no reviewflow board at all; the
   * "Connect reviewflow" prompt and a read error stay above them.
   */
  extraSections?: PullRequestBoardExtraSection[];
  /** Shows the filters and the closed view; without it, the board lists every open pull request. */
  filtering?: PullRequestBoardFiltering;
  /** The screen's own actions, at the end of the board's heading whatever the board's state. */
  actions?: ReactNode;
  /** What the refresh button says it does; `Refresh from reviewflow` by default. */
  refreshLabel?: string;
}

function BoardLoading(): ReactNode {
  return (
    <View role="status" aria-label="Loading pull requests" className="gap-xs">
      <View className="skeleton h-[22px] w-[200px]" />
      <View className="skeleton h-[86px]" />
      <View className="skeleton h-[86px]" />
      <View className="skeleton h-[86px]" />
    </View>
  );
}

/**
 * reviewflow's buckets as it sends them — order, titles, totals, a pull request
 * in two buckets shown in both — under their groups, side by side from `lg`.
 * Reads through the {@link BoardDataSource} of its provider and renders no
 * frame: the app's screen owns the page column and the scrolling.
 */
export function PullRequestBoard({
  onOpenPullRequest,
  renderConnect,
  renderRowExtra,
  extraSections,
  filtering,
  actions,
  refreshLabel = "Refresh from reviewflow",
}: PullRequestBoardProps): ReactNode {
  const source = useBoardDataSource();
  const board = source.useBoard();
  const status = source.useReviewflowStatus();
  const [refreshing, setRefreshing] = useState(false);

  const notConfigured = status.value?.configured === false;
  const data = board.value?.board ?? null;
  const filters = filtering?.value ?? defaultBoardFilters;
  const closedView = filters.state === "closed";
  const closed = source.useClosedPullRequests({
    account: filters.account,
    enabled: closedView && !notConfigured,
  });
  const busy = refreshing || board.reading || closed.reading;
  const readError = closedView ? closed.error : board.error;
  const filtersActive = hasActiveBoardFilters(filters);
  const matches = (pr: ReviewflowBoardPr): boolean =>
    matchesBoardFilters(pr, filters);

  const refresh = (): void => {
    setRefreshing(true);
    source.refresh().finally(() => {
      setRefreshing(false);
    });
  };

  const groups =
    data?.groups
      .map((group) => ({
        ...group,
        buckets: group.buckets
          .map((bucket) => ({ ...bucket, prs: bucket.prs.filter(matches) }))
          .filter((bucket) => bucket.prs.length > 0),
      }))
      .filter((group) => group.buckets.length > 0) ?? [];

  const extras = (extraSections ?? [])
    .map((section) => ({ ...section, rows: section.rows.filter(matches) }))
    .filter((section) => section.rows.length > 0);

  const loadedPrs = closedView
    ? (closed.value?.prs ?? [])
    : [
        ...(data?.groups.flatMap((group) =>
          group.buckets.flatMap((bucket) => bucket.prs),
        ) ?? []),
        ...(extraSections ?? []).flatMap((section) => section.rows),
      ];

  const noMatch = (
    <EmptyState icon={<FunnelRegularIcon />} title="No match">
      No pull request matches these filters.
    </EmptyState>
  );

  const extrasBody =
    extras.length === 0 ? null : (
      <View className="gap-l">
        {extras.map((section) => (
          <BoardBucketSection
            key={section.key}
            bucket={{
              key: section.key,
              title: section.title,
              total: section.rows.length,
              prs: section.rows,
            }}
            groupKey={extraSectionGroupKey}
            icon={section.icon}
            accent={section.accent}
            viewer={board.value?.viewer ?? null}
            renderRowExtra={renderRowExtra}
            onOpenPullRequest={onOpenPullRequest}
          />
        ))}
      </View>
    );

  const body = ((): ReactNode => {
    if (notConfigured) {
      return (
        <View className="gap-xl">
          <View className="items-center gap-m">
            <EmptyState icon={<PlugsRegularIcon />} title="Connect reviewflow">
              Your pull requests are listed here once a reviewflow token is
              saved.
            </EmptyState>
            {renderConnect?.()}
          </View>
          {extrasBody}
        </View>
      );
    }
    if (closedView) {
      if (closed.value === null) {
        return closed.error === null ? <BoardLoading /> : null;
      }
      const closedRows = closed.value.prs.filter(matches);
      if (closedRows.length === 0) {
        return filtersActive ? (
          noMatch
        ) : (
          <EmptyState
            icon={<TrayRegularIcon />}
            title="No closed pull requests"
          >
            The pull requests you created, are assigned to or reviewed are
            listed here once closed.
          </EmptyState>
        );
      }
      return (
        <BoardBucketSection
          bucket={{
            key: closedSectionGroupKey,
            title: "Closed pull requests",
            total: closed.value.total,
            prs: closedRows,
          }}
          groupKey={closedSectionGroupKey}
          viewer={closed.value.viewer}
          renderRowExtra={renderRowExtra}
          onOpenPullRequest={onOpenPullRequest}
        />
      );
    }
    if (extrasBody !== null && groups.length === 0) return extrasBody;
    if (board.value === null) {
      if (board.error !== null) return null;
      return <BoardLoading />;
    }
    if (data === null) {
      return (
        <EmptyState icon={<TrayRegularIcon />} title="No board yet">
          reviewflow has not been read yet: refresh to read it.
        </EmptyState>
      );
    }
    if (groups.length === 0) {
      if (filtersActive) return noMatch;
      return (
        <EmptyState icon={<ConfettiRegularIcon />} title="Nothing to review">
          Nothing is waiting for you, and none of your pull requests are in
          progress.
        </EmptyState>
      );
    }
    const buckets = (
      <View className="gap-xl lg:flex-row lg:items-start">
        {groups.map((group) => (
          <View key={group.key} className="gap-m lg:min-w-0 lg:flex-1">
            <Text
              role="heading"
              aria-level={2}
              className="font-heading-extrabold text-xl"
            >
              {group.title}
            </Text>
            <View className="gap-l">
              {group.buckets.map((bucket) => (
                <BoardBucketSection
                  key={bucket.key}
                  bucket={bucket}
                  groupKey={group.key}
                  viewer={board.value?.viewer ?? null}
                  renderRowExtra={renderRowExtra}
                  onOpenPullRequest={onOpenPullRequest}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    );
    return extrasBody === null ? (
      buckets
    ) : (
      <View className="gap-xl">
        {buckets}
        {extrasBody}
      </View>
    );
  })();

  return (
    <View className="gap-l">
      <View className="flex-row flex-wrap items-center gap-m">
        <Text
          role="heading"
          aria-level={1}
          className="min-w-0 flex-1 font-heading-extrabold text-3xl xl:text-4xl"
        >
          Pull requests
        </Text>
        <View className="flex-row items-center gap-xs">
          {notConfigured || closedView || data === null ? null : (
            <Text className="text-xs text-muted">
              {`${board.cached === true ? "Cached, updated" : "Updated"} ${formatDataAge(data.fetchedAt)}`}
            </Text>
          )}
          {notConfigured ? null : (
            <IconButton
              icon={<ArrowsClockwiseRegularIcon />}
              size="sm"
              variant="soft"
              accent="neutral"
              aria-label={refreshLabel}
              disabledReason={busy ? "Refreshing…" : null}
              onPress={refresh}
            />
          )}
          {actions}
        </View>
      </View>
      {filtering === undefined || notConfigured ? null : (
        <BoardFiltersBar
          filters={filters}
          accounts={status.value?.accounts ?? []}
          options={buildBoardFilterOptions(loadedPrs, filters)}
          onChange={filtering.onChange}
        />
      )}
      {notConfigured || readError === null ? null : (
        <WarningMessage>{errorToMessage(readError)}</WarningMessage>
      )}
      {body}
    </View>
  );
}
