import { isAttachablePath } from "@reviewflow/sdk";
import {
  IndeterminateCircularProgress,
  PressableBox,
  ScrollView,
  Text,
  View,
} from "alouette";
import type { ReactNode } from "react";
import { Suspense, lazy } from "react";
import { Platform } from "react-native";
import { useDiffSettings } from "./branch-diff/use-diff-settings.tsx";
import { FileTypeIcon } from "./file-type-icon.tsx";
import { omissionLabel } from "./omitted-files.tsx";
import type { DiffTreeFile } from "./pull-request-diff-tree-files.ts";
import {
  isOmittedFile,
  statusAccents,
  statusLetters,
} from "./pull-request-diff-tree-files.ts";

const PullRequestDiffTree = lazy(() => import("./pull-request-diff-tree.tsx"));

/** the tree renders DOM in a shadow root */
const treeAvailable = Platform.OS === "web";

const noViewedPaths: readonly string[] = [];

export interface ChangedFilesTreeProps {
  /** one diff's files, `changedFilesOf(diff)`: one tree per scope */
  files: readonly DiffTreeFile[];
  /** the file shown elsewhere, selected in the tree; null: none */
  selectedPath: string | null;
  /** a file was pressed; a left out one too, which the diff has no patch of */
  onSelect: (path: string) => void;
}

const splitPath = (path: string): { name: string; directory: string } => {
  const slash = path.lastIndexOf("/");
  return {
    name: path.slice(slash + 1),
    directory: path.slice(0, Math.max(slash, 0)),
  };
};

interface FileCountsProps {
  file: DiffTreeFile;
}

function FileCounts({ file }: FileCountsProps): ReactNode {
  const { additions, deletions } = file;
  if (additions == null || deletions == null) return null;
  return (
    <Text className="font-mono text-xs">
      <Text accent="success" className="font-mono text-xs text-accent">
        {`+${String(additions)}`}
      </Text>
      <Text accent="danger" className="font-mono text-xs text-accent">
        {` −${String(deletions)}`}
      </Text>
    </Text>
  );
}

interface ChangedFileRowProps {
  file: DiffTreeFile;
  selected: boolean;
  onSelect: (path: string) => void;
}

/** The name in its status's color, its directory after it, cut first when narrow. */
function ChangedFileRow({
  file,
  selected,
  onSelect,
}: ChangedFileRowProps): ReactNode {
  const { path, status } = file;
  const { name, directory } = splitPath(path);
  const accent = status === null ? undefined : statusAccents[status];
  const omitted = isOmittedFile(file);
  const description = [
    status,
    omitted
      ? `left out${file.omitted === undefined ? "" : `, ${omissionLabel(file.omitted)}`}`
      : null,
    file.additions == null || file.deletions == null
      ? null
      : `${String(file.additions)} added, ${String(file.deletions)} removed`,
  ].filter((part) => part !== null);
  return (
    <View
      className={selected ? "rounded-sm bg-interactive-soft-active" : undefined}
    >
      <PressableBox
        variant="soft"
        accent="neutral"
        aria-selected={selected}
        aria-label={[path, ...description].join(", ")}
        className="min-h-[26px] flex-row items-center gap-xxs rounded-sm px-xs"
        onPress={() => {
          onSelect(path);
        }}
      >
        <FileTypeIcon path={path} test={isAttachablePath(path)} size={12} />
        <Text numberOfLines={1} className="min-w-0 shrink text-xs">
          <Text
            accent={accent}
            className={
              accent === undefined
                ? "font-body text-xs text-muted"
                : "font-body text-xs text-accent"
            }
          >
            {name}
          </Text>
          {directory === "" ? null : (
            <Text className="font-body text-xs text-muted">{`  ${directory}`}</Text>
          )}
        </Text>
        <View className="ml-auto shrink-0 flex-row items-center gap-xs">
          {omitted ? (
            <Text className="text-xs text-muted">left out</Text>
          ) : (
            <FileCounts file={file} />
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

/** Outside the web: one row per file, in the order given. */
function ChangedFilesList({
  files,
  selectedPath,
  onSelect,
}: ChangedFilesTreeProps): ReactNode {
  return (
    <ScrollView className="flex-1">
      {files.map((file) => (
        <ChangedFileRow
          key={file.path}
          file={file}
          selected={file.path === selectedPath}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

function Loading(): ReactNode {
  return (
    <View className="items-center py-m">
      <IndeterminateCircularProgress loading />
    </View>
  );
}

/**
 * The files one diff changed, for a host that shows the selected file's diff
 * elsewhere (`DiffViewer`'s `path`). On the web, the pull request's file tree:
 * by folder, searchable, virtualized, each row with its git status and line
 * counts (`+12 −3`) in the diff theme's git colors, loaded lazily. Elsewhere a
 * plain list of the same rows.
 *
 * It fills its parent, width and height: the parent gives it a bounded height,
 * which the web tree needs to virtualize. It reacts to no key outside itself,
 * so a terminal beside it keeps every shortcut. The theme comes from
 * `DiffSettingsProvider`; an empty `files` shows an empty tree, saying that
 * nothing changed is the host's.
 */
export function ChangedFilesTree({
  files,
  selectedPath,
  onSelect,
}: ChangedFilesTreeProps): ReactNode {
  const { theme } = useDiffSettings();
  if (!treeAvailable) {
    return (
      <ChangedFilesList
        files={files}
        selectedPath={selectedPath}
        onSelect={onSelect}
      />
    );
  }
  return (
    <View className="min-h-0 min-w-0 flex-1">
      <Suspense fallback={<Loading />}>
        <PullRequestDiffTree
          files={files}
          viewedPaths={noViewedPaths}
          theme={theme}
          selectedPath={selectedPath}
          onFilePress={onSelect}
        />
      </Suspense>
    </View>
  );
}
