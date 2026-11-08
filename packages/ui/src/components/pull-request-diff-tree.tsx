import { getResolvedOrResolveTheme } from "@pierre/diffs";
import type {
  FileTree as FileTreeModel,
  FileTreeRowDecoration,
  GitStatusEntry,
} from "@pierre/trees";
import { themeToTreeStyles } from "@pierre/trees";
import { FileTree, useFileTree } from "@pierre/trees/react";
import type { AccentOrNeutral } from "alouette";
import { AccentScope, useCurrentMode } from "alouette";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { DiffTheme } from "./branch-diff/diff-themes.ts";
import { diffThemeNames } from "./branch-diff/diff-themes.ts";
import type { DiffTreeFile } from "./pull-request-diff-tree-files.ts";

export interface PullRequestDiffTreeProps {
  files: DiffTreeFile[];
  viewedPaths: readonly string[];
  /** the diff's highlighting theme, whose git colors the statuses take */
  theme: DiffTheme;
  /** brings the file into view in the diff */
  onFilePress: (path: string) => void;
}

interface DecorationData {
  viewedPaths: ReadonlySet<string>;
  omittedPaths: ReadonlySet<string>;
}

type CustomProperties = CSSProperties & Record<`--${string}`, string>;

/**
 * Custom properties cross the shadow root, and a `var()` in one resolves where
 * it is declared, inside alouette's theme: the tree takes the screen's tokens.
 * A status takes the diff theme's git color, as the diff's file headers do, and
 * the color of its accent when the theme has none (`CapturedAccent`).
 */
const hostStyle = (
  mode: "dark" | "light",
  gitColors: CustomProperties,
): CustomProperties => ({
  ...gitColors,
  height: "100%",
  colorScheme: mode,
  "--trees-bg-override": "transparent",
  "--trees-fg-override": "var(--color-sharp)",
  "--trees-fg-muted-override": "var(--color-muted)",
  "--trees-bg-muted-override": "var(--color-interactive-soft-hover)",
  "--trees-selected-bg-override": "var(--color-interactive-soft-active)",
  "--trees-selected-fg-override": "var(--color-sharp)",
  "--trees-border-color-override": "var(--color-border-muted)",
  "--trees-indent-guide-bg-override": "var(--color-border-muted)",
  "--trees-input-bg-override": "var(--color-lowered)",
  "--trees-search-bg-override": "var(--color-lowered)",
  "--trees-search-fg-override": "var(--color-sharp)",
  "--trees-accent-override": "var(--tree-brand)",
  "--trees-focus-ring-color-override": "var(--tree-brand)",
  "--trees-status-added-override":
    "var(--trees-theme-git-added-fg, var(--tree-success))",
  "--trees-status-untracked-override":
    "var(--trees-theme-git-untracked-fg, var(--tree-success))",
  "--trees-status-modified-override":
    "var(--trees-theme-git-modified-fg, var(--tree-info))",
  "--trees-status-renamed-override":
    "var(--trees-theme-git-renamed-fg, var(--tree-warning))",
  "--trees-status-deleted-override":
    "var(--trees-theme-git-deleted-fg, var(--tree-danger))",
  "--trees-font-family-override": "var(--font-body)",
  "--trees-font-size-override": "var(--text-sm, 13px)",
  "--trees-padding-inline-override": "0px",
});

/** Holds `accent`'s color as `--tree-<accent>` for the subtree, whatever accent it is under. */
function CapturedAccent({
  accent,
  children,
}: {
  accent: Exclude<AccentOrNeutral, "neutral">;
  children: ReactNode;
}): ReactNode {
  const style: CustomProperties = {
    display: "contents",
    [`--tree-${accent}`]: "var(--color-accent)",
  };
  return (
    <AccentScope accent={accent}>
      <div style={style}>{children}</div>
    </AccentScope>
  );
}

const gitColorsOf = (styles: Record<string, string>): CustomProperties =>
  Object.fromEntries(
    Object.entries(styles).filter(([key]) =>
      key.startsWith("--trees-theme-git-"),
    ),
  );

interface ThemeGitColors {
  themeName: string;
  colors: CustomProperties;
}

/** Empty until the theme resolves, or when it cannot: the accents stand in. */
const useThemeGitColors = (themeName: string): CustomProperties => {
  const [resolved, setResolved] = useState<ThemeGitColors | null>(null);
  useEffect(() => {
    let current = true;
    Promise.resolve(getResolvedOrResolveTheme(themeName)).then(
      (theme) => {
        if (current) {
          setResolved({
            themeName,
            colors: gitColorsOf(themeToTreeStyles(theme)),
          });
        }
      },
      () => {
        if (current) setResolved({ themeName, colors: {} });
      },
    );
    return () => {
      current = false;
    };
  }, [themeName]);
  return resolved?.themeName === themeName ? resolved.colors : {};
};

const gitStatusOf = (files: readonly DiffTreeFile[]): GitStatusEntry[] =>
  files.flatMap(({ path, status }) =>
    status === null ? [] : [{ path, status }],
  );

const decorationOf = (
  path: string,
  { viewedPaths, omittedPaths }: DecorationData,
): FileTreeRowDecoration | null => {
  if (omittedPaths.has(path)) {
    return { text: "left out", title: "Not in the diff: listed above it" };
  }
  if (viewedPaths.has(path)) return { text: "viewed", title: "Marked viewed" };
  return null;
};

/**
 * The range's files by folder, in `@pierre/trees`: searchable, virtualized,
 * each file's git status and viewed mark on its row. Web only (DOM in a shadow
 * root), loaded lazily as the diff viewer is.
 *
 * The model is created once and fed through its methods. Selecting a file
 * scrolls the diff to it and is undone at once, so pressing the same file
 * again scrolls again. The row decorations have no setter: they read the
 * latest data from a ref, and resetting the git status repaints them.
 */
function PullRequestDiffTree({
  files,
  viewedPaths: viewedList,
  theme,
  onFilePress,
}: PullRequestDiffTreeProps): ReactNode {
  const mode = useCurrentMode();
  const gitColors = useThemeGitColors(diffThemeNames(theme)[mode]);
  const paths = files.map(({ path }) => path);
  const pathsKey = paths.join("\n");
  const repaintKey = [
    ...files.map(({ path, status }) => `${status ?? "omitted"} ${path}`),
    ...viewedList,
  ].join("\n");
  const viewedPaths = new Set(viewedList);
  const omittedPaths = new Set(
    files.filter(({ status }) => status === null).map(({ path }) => path),
  );
  const latest = useRef({ files, onFilePress, viewedPaths, omittedPaths });
  const filePaths = useRef(new Set(paths));
  const modelRef = useRef<FileTreeModel | null>(null);
  const appliedPathsKey = useRef(pathsKey);

  const { model } = useFileTree({
    paths,
    flattenEmptyDirectories: true,
    initialExpansion: "open",
    density: "compact",
    icons: { set: "standard", colored: false },
    search: true,
    fileTreeSearchMode: "hide-non-matches",
    gitStatus: gitStatusOf(files),
    renderRowDecoration: ({ item }) =>
      item.kind === "file" ? decorationOf(item.path, latest.current) : null,
    onSelectionChange: (selected) => {
      const path = selected.at(-1);
      if (path === undefined || !filePaths.current.has(path)) return;
      latest.current.onFilePress(path);
      queueMicrotask(() => {
        modelRef.current?.getItem(path)?.deselect();
      });
    },
  });

  useEffect(() => {
    modelRef.current = model;
    latest.current = { files, onFilePress, viewedPaths, omittedPaths };
    filePaths.current = new Set(paths);
  });

  useEffect(() => {
    const current = latest.current.files;
    if (appliedPathsKey.current !== pathsKey) {
      appliedPathsKey.current = pathsKey;
      model.resetPaths(current.map(({ path }) => path));
    }
    model.setGitStatus(gitStatusOf(current));
  }, [model, pathsKey, repaintKey]);

  return (
    <CapturedAccent accent="brand">
      <CapturedAccent accent="success">
        <CapturedAccent accent="info">
          <CapturedAccent accent="warning">
            <CapturedAccent accent="danger">
              <AccentScope accent="neutral">
                <FileTree model={model} style={hostStyle(mode, gitColors)} />
              </AccentScope>
            </CapturedAccent>
          </CapturedAccent>
        </CapturedAccent>
      </CapturedAccent>
    </CapturedAccent>
  );
}

export default PullRequestDiffTree;
