import type {
  DiffGroup,
  DiffImpactsResponse,
  DiffOmittedFile,
  DiffReadingOrderResponse,
} from "@reviewflow/sdk";
import { isAttachablePath, subjectsOf } from "@reviewflow/sdk";
import { Icon, PressableBox, Text, View } from "alouette";
import { FileRegularIcon } from "alouette-icons/phosphor-icons/File";
import { FileTsRegularIcon } from "alouette-icons/phosphor-icons/FileTs";
import { PackageDuotoneIcon } from "alouette-icons/phosphor-icons/Package";
import { TestTubeRegularIcon } from "alouette-icons/phosphor-icons/TestTube";
import type { ReactNode } from "react";
import { PullRequestDiffImpactsSummary } from "./pull-request-diff-impacts-summary.tsx";
import type { ImpactsStatus } from "./pull-request-diff-impacts.ts";
import { pluralOf } from "./pull-request-diff-impacts.ts";

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

const typescriptFile = /\.[cm]?tsx?$/;

function FileIcon({ path, test }: { path: string; test: boolean }): ReactNode {
  if (test) {
    return (
      <Icon icon={<TestTubeRegularIcon />} size={16} className="text-muted" />
    );
  }
  if (typescriptFile.test(path)) {
    return (
      <Icon icon={<FileTsRegularIcon />} size={16} className="text-muted" />
    );
  }
  return <Icon icon={<FileRegularIcon />} size={16} className="text-muted" />;
}

interface OverviewFileProps {
  path: string;
  /** what is shown of the path: from its workspace, or its subject's directory */
  label: string;
  entry: boolean;
  test: boolean;
  indented: boolean;
  /** null: not in the diff below (an omitted file), nothing to go to */
  onPress: (() => void) | null;
}

/** The file's name first, its directory under it, so the names line up. */
function OverviewFile({
  path,
  label,
  entry,
  test,
  indented,
  onPress,
}: OverviewFileProps): ReactNode {
  const slash = label.lastIndexOf("/");
  const directory = label.slice(0, Math.max(slash, 0));
  const content = (
    <View className="flex-row items-start gap-xs">
      <View className="pt-[2px]">
        <FileIcon path={path} test={test} />
      </View>
      <View className="min-w-0 shrink gap-[1px]">
        {/* one Text, so "entry" sits on the name's baseline */}
        <Text
          className={
            test ? "text-sm text-muted" : "font-body-bold text-sm text-sharp"
          }
        >
          {label.slice(slash + 1)}
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
  const frame = indented
    ? "ml-l rounded-sm px-xs py-xxs"
    : "rounded-sm px-xs py-xxs";
  if (onPress === null) return <View className={frame}>{content}</View>;
  return (
    <PressableBox
      variant="soft"
      accent="neutral"
      aria-label={`Go to ${path}`}
      className={frame}
      onPress={onPress}
    >
      {content}
    </PressableBox>
  );
}

const statusNotes: Record<OverviewReadingOrderStatus, string | null> = {
  ready: null,
  none: null,
  reading: "Reading the entry points: files are listed meanwhile.",
  failed: "The entry points could not be read: files are listed instead.",
};

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
  /** brings the file into view in the diff below */
  onFilePress: (path: string) => void;
  /**
   * In a column beside the diff, which scrolls on its own: every file, one a
   * line, its tests indented below it, with no cap on their number.
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
    <View className="gap-l py-xs" role="region" aria-label="Changes overview">
      <View className="flex-row items-baseline gap-xs">
        <Text className="font-heading-bold text-lg text-sharp">Changes</Text>
        <Text className="text-sm text-muted">
          {`in ${pluralOf(workspaces.length, "workspace")}`}
        </Text>
      </View>
      {workspaces.map(({ name, files, tests, names }) => (
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
              {tests === 0
                ? pluralOf(files, "file")
                : `${pluralOf(files, "file")} · ${pluralOf(tests, "test")}`}
            </Text>
          </View>
          {showNames && names.length > 0 ? (
            <View className={aside ? "gap-xxs" : "flex-row flex-wrap gap-xs"}>
              {names.map(({ path, entry, shown, subject }) => (
                <OverviewFile
                  key={path}
                  path={path}
                  label={labelOf(name, path, subject)}
                  entry={entry}
                  test={isAttachablePath(path)}
                  indented={subject !== null}
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
      ))}
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
