import type {
  DiffGroup,
  DiffImpactsResponse,
  DiffOmittedFile,
  DiffReadingOrderResponse,
} from "@reviewflow/sdk";
import { isAttachablePath, pluralOf, subjectsOf } from "@reviewflow/sdk";
import type { Accent } from "alouette";
import { Icon, PressableBox, Text, View } from "alouette";
import { CaretDownRegularIcon } from "alouette-icons/phosphor-icons/CaretDown";
import { CaretRightRegularIcon } from "alouette-icons/phosphor-icons/CaretRight";
import { PackageDuotoneIcon } from "alouette-icons/phosphor-icons/Package";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { View as RNView } from "react-native";
import { FileTypeIcon } from "./file-type-icon.tsx";
import { PullRequestDiffImpactsSummary } from "./pull-request-diff-impacts-summary.tsx";
import type { ImpactsStatus } from "./pull-request-diff-impacts.ts";
import type { OverviewTreeRow } from "./pull-request-diff-overview-tree.ts";
import {
  fileIdOf,
  overviewTreeActionOf,
  workspaceIdOf,
} from "./pull-request-diff-overview-tree.ts";
import type { DiffTreeFileStatus } from "./pull-request-diff-tree-files.ts";
import { revealWithinScrollParent } from "./scroll-parent.ts";

/** Past this many names over the range, the rows carry their counts only. */
export const maxOverviewNames = 50;

/** `none`: no checkout, or a source that cannot order. */
export type OverviewReadingOrderStatus =
  | "failed"
  | "none"
  | "reading"
  | "ready";

interface OverviewName {
  path: string;
  entry: boolean;
  /** in the patch, so the viewer renders it: false for an omitted file */
  shown: boolean;
  /** the file a test covers, listed above it; null for any other name */
  subject: string | null;
}

interface OverviewWorkspace {
  name: string;
  files: number;
  tests: number;
  names: OverviewName[];
}

/**
 * The workspace of a path the groups do not list (an omitted file): the
 * longest group directory holding it, else its first directory, as the diff
 * groups a repository without checkout.
 */
const workspaceOf = (path: string, names: readonly string[]): string => {
  const holding = names
    .filter((name) => name !== "" && path.startsWith(`${name}/`))
    .toSorted((left, right) => right.length - left.length)[0];
  if (holding !== undefined) return holding;
  if (names.includes("")) return "";
  const slash = path.indexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
};

interface SummarizeInput {
  groups: readonly DiffGroup[];
  omitted: readonly DiffOmittedFile[];
  readingOrder: DiffReadingOrderResponse | null;
  displayOrder: DiffReadingOrderResponse | null;
  /** every file rather than the roots */
  every: boolean;
}

/**
 * The paths as the viewer lays them out: by the reading order when it orders
 * the files, its tests below each file; by the groups otherwise. A path it
 * does not name comes after, as the viewer appends it.
 */
const displayedPaths = (
  groups: readonly DiffGroup[],
  displayOrder: DiffReadingOrderResponse | null,
): string[] => [
  ...new Set([
    ...(displayOrder?.groups ?? []).flatMap(({ files }) =>
      files.flatMap(({ path, attached }) => [path, ...attached]),
    ),
    ...groups.flatMap(({ paths }) => paths),
  ]),
];

interface WithTestsInput {
  paths: readonly string[];
  code: readonly string[];
  /** a test's subject as the reading order attached it */
  readSubjects: ReadonlyMap<string, string>;
  byPosition: (left: string, right: string) => number;
  nameOf: (path: string, subject: string | null) => OverviewName;
}

/**
 * Every file of a workspace, each followed by its tests, whatever the order
 * of the diff: the reading order's subject, else one named like it
 * (`subjectsOf`). A test covering no changed file comes last.
 */
const withTests = ({
  paths,
  code,
  readSubjects,
  byPosition,
  nameOf,
}: WithTestsInput): OverviewName[] => {
  const codeSet = new Set(code);
  const testsOf = new Map<string, string[]>();
  const uncovered: string[] = [];
  for (const test of paths.filter(isAttachablePath)) {
    const subject =
      readSubjects.get(test) ??
      subjectsOf(test).find((candidate) => codeSet.has(candidate));
    if (subject === undefined || !codeSet.has(subject)) uncovered.push(test);
    else testsOf.set(subject, [...(testsOf.get(subject) ?? []), test]);
  }
  return [
    ...code
      .toSorted(byPosition)
      .flatMap((path) => [
        nameOf(path, null),
        ...(testsOf.get(path) ?? [])
          .toSorted(byPosition)
          .map((test) => nameOf(test, path)),
      ]),
    ...uncovered.toSorted(byPosition).map((test) => nameOf(test, null)),
  ];
};

const summarize = ({
  groups,
  omitted,
  readingOrder,
  displayOrder,
  every,
}: SummarizeInput): OverviewWorkspace[] => {
  const groupNames = [
    ...new Set([
      ...(displayOrder?.groups ?? []).map(({ name }) => name),
      ...groups.map(({ name }) => name),
    ]),
  ];
  const pathsByWorkspace = new Map<string, string[]>(
    groupNames.map((name) => [name, []]),
  );
  for (const { name, paths } of groups) {
    pathsByWorkspace.get(name)!.push(...paths);
  }
  for (const { path } of omitted) {
    const name = workspaceOf(path, groupNames);
    pathsByWorkspace.set(name, [...(pathsByWorkspace.get(name) ?? []), path]);
  }
  const readingFiles = new Map(
    (readingOrder?.groups ?? []).map(({ name, files }) => [name, files]),
  );
  const position = new Map(
    displayedPaths(groups, displayOrder).map((path, index) => [path, index]),
  );
  const byPosition = (left: string, right: string): number =>
    (position.get(left) ?? Infinity) - (position.get(right) ?? Infinity) || 0;
  const entries = new Set(
    (readingOrder?.groups ?? []).flatMap(({ files }) =>
      files.filter(({ entry }) => entry).map(({ path }) => path),
    ),
  );
  const readSubjects = new Map(
    (readingOrder?.groups ?? []).flatMap(({ files }) =>
      files.flatMap(({ path, attached }) =>
        attached.map((test) => [test, path] as const),
      ),
    ),
  );
  const nameOf = (path: string, subject: string | null): OverviewName => ({
    path,
    entry: entries.has(path),
    shown: position.has(path),
    subject,
  });

  return [...pathsByWorkspace]
    .filter(([, paths]) => paths.length > 0)
    .map(([name, paths]) => {
      const code = paths.filter((path) => !isAttachablePath(path));
      const roots = (readingFiles.get(name) ?? []).filter(({ root }) => root);
      const names = ((): OverviewName[] => {
        if (every) {
          return withTests({ paths, code, readSubjects, byPosition, nameOf });
        }
        const listed = roots.length > 0 ? roots.map(({ path }) => path) : code;
        return listed.toSorted(byPosition).map((path) => nameOf(path, null));
      })();
      return {
        name,
        files: code.length,
        tests: paths.length - code.length,
        names,
      };
    });
};

const relativeTo = (workspace: string, path: string): string =>
  workspace !== "" && path.startsWith(`${workspace}/`)
    ? path.slice(workspace.length + 1)
    : path;

/** A test listed under its subject is named from the subject's directory. */
const labelOf = (
  workspace: string,
  path: string,
  subject: string | null,
): string => {
  if (subject === null) return relativeTo(workspace, path);
  const directory = subject.slice(0, subject.lastIndexOf("/"));
  return relativeTo(directory, path);
};

const splitLabel = (label: string): { name: string; directory: string } => {
  const slash = label.lastIndexOf("/");
  return {
    name: label.slice(slash + 1),
    directory: label.slice(0, Math.max(slash, 0)),
  };
};

/** The tree's git colors where the diff theme has none (`PullRequestDiffTree`). */
const statusAccents: Record<DiffTreeFileStatus, Accent> = {
  added: "success",
  modified: "info",
  renamed: "warning",
  deleted: "danger",
};

const statusLetters: Record<DiffTreeFileStatus, string> = {
  added: "A",
  modified: "M",
  renamed: "R",
  deleted: "D",
};

const countsOf = (files: number, tests: number): string =>
  tests === 0
    ? pluralOf(files, "file")
    : `${pluralOf(files, "file")} · ${pluralOf(tests, "test")}`;

interface OverviewChipProps {
  path: string;
  label: string;
  entry: boolean;
  status: DiffTreeFileStatus | null;
  /** null: not in the diff below (an omitted file), nothing to go to */
  onPress: (() => void) | null;
}

/** Inline, on a narrow screen: the file's name first, its directory under it, so the names line up. */
function OverviewChip({
  path,
  label,
  entry,
  status,
  onPress,
}: OverviewChipProps): ReactNode {
  const { name, directory } = splitLabel(label);
  const test = isAttachablePath(path);
  const content = (
    <View className="flex-row items-start gap-xs">
      <View className="pt-[2px]">
        <FileTypeIcon path={path} test={test} size={16} />
      </View>
      <View className="min-w-0 shrink gap-[1px]">
        {/* one Text, so "entry" sits on the name's baseline */}
        <Text
          accent={status === null ? undefined : statusAccents[status]}
          className={((): string => {
            if (status !== null) {
              return test
                ? "text-sm text-accent"
                : "font-body-bold text-sm text-accent";
            }
            return test
              ? "text-sm text-muted"
              : "font-body-bold text-sm text-sharp";
          })()}
        >
          {name}
          {entry ? (
            <Text className="font-body text-xs text-muted"> · entry</Text>
          ) : null}
        </Text>
        {directory === "" ? null : (
          <Text className="text-xs text-muted">{directory}</Text>
        )}
      </View>
    </View>
  );
  if (onPress === null) {
    return <View className="rounded-sm px-xs py-xxs">{content}</View>;
  }
  return (
    <PressableBox
      variant="soft"
      accent="neutral"
      aria-label={`Go to ${path}`}
      className="rounded-sm px-xs py-xxs"
      onPress={onPress}
    >
      {content}
    </PressableBox>
  );
}

/** A vertical line under the icon of each ancestor row, as the tree draws them. */
function IndentGuides({ level }: { level: 2 | 3 }): ReactNode {
  return (
    <>
      <View className="absolute inset-y-0 left-[15px] w-px bg-border-muted" />
      {level === 3 ? (
        <View className="absolute inset-y-0 left-[31px] w-px bg-border-muted" />
      ) : null}
    </>
  );
}

interface TreeRowFocus {
  /** the one row the Tab key reaches: the others are reached with the arrows */
  tabbable: boolean;
  onFocus: () => void;
  rowRef: (node: RNView | null) => () => void;
}

interface TreeWorkspaceRowProps extends TreeRowFocus {
  name: string;
  files: number;
  tests: number;
  expanded: boolean;
  onToggle: () => void;
}

/** Pinned at the top of the column while its files scroll under it. */
function TreeWorkspaceRow({
  name,
  files,
  tests,
  expanded,
  onToggle,
  tabbable,
  onFocus,
  rowRef,
}: TreeWorkspaceRowProps): ReactNode {
  const label = name === "" ? "Root" : name;
  const counts = countsOf(files, tests);
  return (
    <View className="bg-screen web:sticky mt-xs web:top-0 web:z-[1]">
      <PressableBox
        ref={rowRef}
        variant="soft"
        accent="neutral"
        role="treeitem"
        aria-level={1}
        aria-expanded={expanded}
        aria-label={`${label}, ${counts}`}
        tabIndex={tabbable ? 0 : -1}
        className="h-[30px] flex-row items-center gap-xxs rounded-sm px-xs"
        onFocus={onFocus}
        onPress={onToggle}
      >
        <Icon
          icon={expanded ? <CaretDownRegularIcon /> : <CaretRightRegularIcon />}
          size={12}
          className="text-muted"
        />
        <Icon icon={<PackageDuotoneIcon />} size={16} className="text-accent" />
        <Text
          numberOfLines={1}
          className="min-w-0 shrink font-body-bold text-sm text-sharp"
        >
          {label}
        </Text>
        <Text numberOfLines={1} className="ml-auto shrink-0 text-xs text-muted">
          {counts}
        </Text>
      </PressableBox>
    </View>
  );
}

interface TreeFileRowProps extends TreeRowFocus {
  path: string;
  label: string;
  level: 2 | 3;
  entry: boolean;
  status: DiffTreeFileStatus | null;
  viewed: boolean;
  /** the file the diff is scrolled to */
  current: boolean;
  /** null: not in the diff below (an omitted file), nothing to go to */
  onPress: (() => void) | null;
}

/**
 * One line, as a tree row: the name in its status's color, the directory
 * after it, cut first when the column is narrow, then what is said of the
 * file (entry, viewed, left out) and its status letter, at the right edge.
 */
function TreeFileRow({
  path,
  label,
  level,
  entry,
  status,
  viewed,
  current,
  onPress,
  tabbable,
  onFocus,
  rowRef,
}: TreeFileRowProps): ReactNode {
  const { name, directory } = splitLabel(label);
  const accent = status === null ? undefined : statusAccents[status];
  const notes = [
    entry ? "entry" : null,
    onPress === null ? "left out" : null,
    viewed && onPress !== null ? "viewed" : null,
  ].filter((note) => note !== null);
  const description = [status, ...notes].filter((part) => part !== null);
  return (
    <View
      className={current ? "rounded-sm bg-interactive-soft-active" : undefined}
    >
      <PressableBox
        ref={rowRef}
        variant="soft"
        accent="neutral"
        role="treeitem"
        aria-level={level}
        aria-selected={current}
        aria-label={[
          onPress === null ? path : `Go to ${path}`,
          ...description,
        ].join(", ")}
        disabled={onPress === null}
        tabIndex={tabbable ? 0 : -1}
        className={
          level === 2
            ? "h-[26px] flex-row items-center gap-xxs rounded-sm pl-[24px] pr-xs"
            : "h-[26px] flex-row items-center gap-xxs rounded-sm pl-[40px] pr-xs"
        }
        onFocus={onFocus}
        onPress={onPress ?? undefined}
      >
        <IndentGuides level={level} />
        <FileTypeIcon path={path} test={isAttachablePath(path)} size={12} />
        <Text numberOfLines={1} className="min-w-0 shrink text-xs">
          <Text
            accent={accent}
            className={((): string => {
              const weight = entry ? "font-body-bold" : "font-body";
              if (accent !== undefined) return `${weight} text-accent`;
              return onPress === null
                ? `${weight} text-muted`
                : `${weight} text-sharp`;
            })()}
          >
            {name}
          </Text>
          {directory === "" ? null : (
            <Text className="font-body text-xs text-muted">{`  ${directory}`}</Text>
          )}
        </Text>
        <View className="ml-auto shrink-0 flex-row items-center gap-xxs">
          {notes.length === 0 ? null : (
            <Text className="text-xs text-muted">{notes.join(" · ")}</Text>
          )}
          {status === null ? null : (
            <Text
              accent={accent}
              className="w-[10px] text-center font-body-bold text-xs text-accent"
            >
              {statusLetters[status]}
            </Text>
          )}
        </View>
      </PressableBox>
    </View>
  );
}

const focusRow = (node: RNView | undefined): void => {
  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    node.focus();
  }
};

/** Leaves room for the pinned workspace row above the row revealed. */
const pinnedRowHeight = 32;

interface OverviewTreeProps {
  workspaces: readonly OverviewWorkspace[];
  statuses: ReadonlyMap<string, DiffTreeFileStatus>;
  viewedPaths: ReadonlySet<string>;
  currentPath: string | null;
  onFilePress: (path: string) => void;
}

/**
 * Beside the diff: every file as a tree row, under its workspace, which folds;
 * its tests a level below it. One row takes the Tab key and the arrows move
 * between rows (`overviewTreeActionOf`); the file the diff is scrolled to is
 * lit, and kept in view in the column.
 */
function OverviewTree({
  workspaces,
  statuses,
  viewedPaths,
  currentPath,
  onFilePress,
}: OverviewTreeProps): ReactNode {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const treeRef = useRef<RNView>(null);
  const rowNodes = useRef(new Map<string, RNView>());

  const rows: OverviewTreeRow[] = workspaces.flatMap(({ name, names }) => {
    const id = workspaceIdOf(name);
    const expanded = !collapsed.has(id);
    return [
      { id, kind: "workspace", level: 1, parent: null, expanded },
      ...(expanded
        ? names.map(({ path, subject }): OverviewTreeRow => ({
            id: fileIdOf(path),
            kind: "file",
            level: subject === null ? 2 : 3,
            parent: subject === null ? id : fileIdOf(subject),
            expanded: false,
          }))
        : []),
    ];
  });
  const listed = new Set(rows.map(({ id }) => id));
  const currentId = currentPath === null ? null : fileIdOf(currentPath);
  const tabbableId = ((): string | undefined => {
    if (focusedId !== null && listed.has(focusedId)) return focusedId;
    if (currentId !== null && listed.has(currentId)) return currentId;
    return rows[0]?.id;
  })();
  const shownPaths = new Set(
    workspaces.flatMap(({ names }) =>
      names.filter(({ shown }) => shown).map(({ path }) => path),
    ),
  );

  const toggle = (id: string): void => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };
  const press = (id: string): void => {
    if (id.startsWith("workspace:")) {
      toggle(id);
      return;
    }
    const path = id.slice("file:".length);
    if (shownPaths.has(path)) onFilePress(path);
  };
  const focusOf = (id: string): TreeRowFocus => ({
    tabbable: id === tabbableId,
    onFocus: () => {
      setFocusedId(id);
    },
    rowRef: (node) => {
      if (node !== null) rowNodes.current.set(id, node);
      return () => {
        if (rowNodes.current.get(id) === node) rowNodes.current.delete(id);
      };
    },
  });

  const onKeyDown = useEffectEvent((event: KeyboardEvent): void => {
    if (tabbableId === undefined) return;
    const action = overviewTreeActionOf(rows, tabbableId, event.key);
    if (action === null) return;
    event.preventDefault();
    if (action.type === "focus") focusRow(rowNodes.current.get(action.id));
    else if (action.type === "toggle") toggle(action.id);
    else press(action.id);
  });

  // a DOM listener: react-native's View has no keyboard events to type it with
  useEffect(() => {
    const node = treeRef.current;
    if (typeof HTMLElement === "undefined" || !(node instanceof HTMLElement)) {
      return undefined;
    }
    const listener = (event: KeyboardEvent): void => {
      onKeyDown(event);
    };
    node.addEventListener("keydown", listener);
    return () => {
      node.removeEventListener("keydown", listener);
    };
  }, []);

  // follows the diff's scroll, which is not a press in this column
  useEffect(() => {
    if (currentId === null) return;
    const node = rowNodes.current.get(currentId);
    if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
      revealWithinScrollParent(node, pinnedRowHeight);
    }
  }, [currentId]);

  return (
    <View ref={treeRef} role="tree" aria-label="Files in reading order">
      {workspaces.map(({ name, files, tests, names }) => {
        const id = workspaceIdOf(name);
        const expanded = !collapsed.has(id);
        return (
          <View key={name}>
            <TreeWorkspaceRow
              name={name}
              files={files}
              tests={tests}
              expanded={expanded}
              onToggle={() => {
                toggle(id);
              }}
              {...focusOf(id)}
            />
            {expanded
              ? names.map(({ path, entry, shown, subject }) => (
                  <TreeFileRow
                    key={path}
                    path={path}
                    label={labelOf(name, path, subject)}
                    level={subject === null ? 2 : 3}
                    entry={entry}
                    status={shown ? (statuses.get(path) ?? null) : null}
                    viewed={viewedPaths.has(path)}
                    current={path === currentPath}
                    onPress={
                      shown
                        ? () => {
                            onFilePress(path);
                          }
                        : null
                    }
                    {...focusOf(fileIdOf(path))}
                  />
                ))
              : null}
          </View>
        );
      })}
    </View>
  );
}

const statusNotes: Record<OverviewReadingOrderStatus, string | null> = {
  ready: null,
  none: null,
  reading: "Reading the entry points: files are listed meanwhile.",
  failed: "The entry points could not be read: files are listed instead.",
};

const noStatuses: ReadonlyMap<string, DiffTreeFileStatus> = new Map();
const noPaths: readonly string[] = [];

export interface PullRequestDiffOverviewProps {
  /** `PullRequestDiffResponse.groups` of the range shown */
  groups: DiffGroup[];
  /** `PullRequestDiffResponse.omitted`: counted in their workspace */
  omitted: DiffOmittedFile[];
  /** where the roots and entry points come from; null until it is read */
  readingOrder: DiffReadingOrderResponse | null;
  readingOrderStatus: OverviewReadingOrderStatus;
  /** what the touched exports are used by outside the diff; null until it is read */
  impacts?: DiffImpactsResponse | null;
  impactsStatus?: ImpactsStatus;
  /** the reading order when the viewer orders the files by it, null in package order */
  displayOrder: DiffReadingOrderResponse | null;
  /** each file's git status (`fileStatusesOf`); a file it lacks is not colored */
  statuses?: ReadonlyMap<string, DiffTreeFileStatus>;
  /** marked viewed: said on their row aside the diff */
  viewedPaths?: readonly string[];
  /** the file the diff is scrolled to, lit aside the diff */
  currentPath?: string | null;
  /** brings the file into view in the diff below */
  onFilePress: (path: string) => void;
  /**
   * In a column beside the diff, which scrolls on its own: every file as a
   * tree row, its tests a level below it, with no cap on their number.
   */
  aside: boolean;
}

/**
 * What the range touches, by workspace: how many files (tests apart), then
 * the names to start reading from, its roots, else its files (every file
 * aside the diff), in the order the diff below shows them, each a link to its
 * file. Static content on the screen ground, with no surface of its own.
 */
export function PullRequestDiffOverview({
  groups,
  omitted,
  readingOrder,
  readingOrderStatus,
  impacts = null,
  impactsStatus = "none",
  displayOrder,
  statuses = noStatuses,
  viewedPaths = noPaths,
  currentPath = null,
  onFilePress,
  aside,
}: PullRequestDiffOverviewProps): ReactNode {
  const workspaces = summarize({
    groups,
    omitted,
    readingOrder,
    displayOrder,
    every: aside,
  });
  if (workspaces.length === 0) return null;
  const totalNames = workspaces.reduce(
    (total, { names }) => total + names.length,
    0,
  );
  const showNames = aside || totalNames <= maxOverviewNames;
  const note = statusNotes[readingOrderStatus];

  return (
    <View
      className={aside ? "gap-m py-xs" : "gap-l py-xs"}
      role="region"
      aria-label="Changes overview"
    >
      <View>
        <View className="flex-row items-baseline gap-xs">
          <Text className="font-heading-bold text-lg text-sharp">Changes</Text>
          <Text className="text-sm text-muted">
            {`in ${pluralOf(workspaces.length, "workspace")}`}
          </Text>
        </View>
        {aside ? (
          <OverviewTree
            workspaces={workspaces}
            statuses={statuses}
            viewedPaths={new Set(viewedPaths)}
            currentPath={currentPath}
            onFilePress={onFilePress}
          />
        ) : (
          workspaces.map(({ name, files, tests, names }) => (
            <View key={name} className="gap-sm">
              <View className="gap-xxs">
                <View className="flex-row items-center gap-xs">
                  <Icon
                    icon={<PackageDuotoneIcon />}
                    size={20}
                    className="text-accent"
                  />
                  <Text className="shrink font-heading-bold text-base text-sharp">
                    {name === "" ? "Root" : name}
                  </Text>
                </View>
                <Text className="pl-[28px] text-xs text-muted">
                  {countsOf(files, tests)}
                </Text>
              </View>
              {showNames && names.length > 0 ? (
                <View className="flex-row flex-wrap gap-xs">
                  {names.map(({ path, entry, shown }) => (
                    <OverviewChip
                      key={path}
                      path={path}
                      label={labelOf(name, path, null)}
                      entry={entry}
                      status={shown ? (statuses.get(path) ?? null) : null}
                      onPress={
                        shown
                          ? () => {
                              onFilePress(path);
                            }
                          : null
                      }
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
      {showNames ? null : (
        <Text className="text-xs text-muted">
          {`Names are left out past ${String(maxOverviewNames)}.`}
        </Text>
      )}
      {note === null ? null : (
        <Text className="text-xs text-muted">{note}</Text>
      )}
      <PullRequestDiffImpactsSummary impacts={impacts} status={impactsStatus} />
    </View>
  );
}
