import type {
  CheckoutFileAtHead,
  CheckoutFileLink,
  CheckoutFileRead,
  CheckoutFileStatus,
  CheckoutFilesResponse,
  CheckoutLinkDeadEnd,
} from "@reviewflow/sdk";
import {
  Box,
  Code,
  ErrorMessage,
  IndeterminateCircularProgress,
  InfoMessage,
  LinkText,
  PressableBox,
  ScrollView,
  Tab,
  Tabs,
  Text,
  View,
  WarningMessage,
  useCurrentMode,
} from "alouette";
import type { ReactNode } from "react";
import { Suspense, lazy, useState } from "react";
import { FlatList, Platform } from "react-native";
import { codeLanguageOfPath } from "../editor/codeEditorExtensions.ts";
import type { EditableFileSaveResult } from "../editor/editable-file.tsx";
import { EditableFile } from "../editor/editable-file.tsx";
import { useDiffSettings } from "./branch-diff/use-diff-settings.tsx";
import type { CheckoutRead } from "./checkout-view.tsx";
import { FileTypeIcon } from "./file-type-icon.tsx";
import { goToFileShortcutLabel } from "./go-to-file-shortcut.ts";

const PullRequestDiffTree = lazy(() => import("./pull-request-diff-tree.tsx"));
const DraftDiffView = lazy(() => import("./draft-diff-view.tsx"));

/** the tree renders DOM in a shadow root */
const treeAvailable = Platform.OS === "web";

const noViewedPaths: readonly string[] = [];

function Loading(): ReactNode {
  return (
    <View className="items-center py-m">
      <IndeterminateCircularProgress loading />
    </View>
  );
}

export interface CheckoutFileTreeProps {
  /** `listCheckoutFiles`: every file of the working tree, sorted */
  paths: readonly string[];
  /** `listCheckoutFiles`: each changed file's git state; a path absent is unchanged */
  statuses: Readonly<Record<string, CheckoutFileStatus>>;
  /** the file open elsewhere, selected in the tree; null: none */
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

const statusLetters: Record<CheckoutFileStatus, string> = {
  added: "A",
  deleted: "D",
  modified: "M",
  untracked: "U",
};

/** Outside the web: one row per file, its directory after its name, its git state's letter last. */
function CheckoutFileList({
  paths,
  statuses,
  selectedPath,
  onSelect,
}: CheckoutFileTreeProps): ReactNode {
  return (
    <FlatList
      className="flex-1"
      data={paths}
      keyExtractor={(path) => path}
      renderItem={({ item: path }) => {
        const slash = path.lastIndexOf("/");
        const selected = path === selectedPath;
        const status = statuses[path];
        return (
          <View
            className={
              selected ? "rounded-sm bg-interactive-soft-active" : undefined
            }
          >
            <PressableBox
              variant="soft"
              accent="neutral"
              aria-selected={selected}
              aria-label={path}
              className="min-h-[26px] flex-row items-center gap-xxs rounded-sm px-xs"
              onPress={() => {
                onSelect(path);
              }}
            >
              <FileTypeIcon path={path} test={false} size={12} />
              <Text numberOfLines={1} className="min-w-0 shrink text-xs">
                <Text className="font-body text-xs">
                  {path.slice(slash + 1)}
                </Text>
                {slash === -1 ? null : (
                  <Text className="font-body text-xs text-muted">{`  ${path.slice(0, slash)}`}</Text>
                )}
              </Text>
              {status === undefined ? null : (
                <Text
                  aria-label={status}
                  className="ml-auto w-[10px] text-center font-body-bold text-xs text-muted"
                >
                  {statusLetters[status]}
                </Text>
              )}
            </PressableBox>
          </View>
        );
      }}
    />
  );
}

/**
 * A checkout's files, for a host that opens the selected one elsewhere
 * (`CheckoutFileEditor`). On the web, the pull request's tree in its listing
 * mode: by folder, folders closed, searchable, virtualized, its search opened
 * by ⌘P / Ctrl+P from anywhere on the page while it is mounted. Elsewhere a
 * flat list of the same files.
 *
 * Fills its parent, which gives it a bounded height for the tree to
 * virtualize. The theme comes from `DiffSettingsProvider`, as
 * `ChangedFilesTree`'s does.
 */
export function CheckoutFileTree({
  paths,
  statuses,
  selectedPath,
  onSelect,
}: CheckoutFileTreeProps): ReactNode {
  const { theme } = useDiffSettings();
  if (!treeAvailable) {
    return (
      <CheckoutFileList
        paths={paths}
        statuses={statuses}
        selectedPath={selectedPath}
        onSelect={onSelect}
      />
    );
  }
  return (
    <View className="min-h-0 min-w-0 flex-1">
      <Suspense fallback={<Loading />}>
        <PullRequestDiffTree
          listing
          goToFileShortcut
          listingStatuses={statuses}
          files={paths.map((path) => ({ path, status: null }))}
          viewedPaths={noViewedPaths}
          theme={theme}
          selectedPath={selectedPath}
          onFilePress={onSelect}
        />
      </Suspense>
    </View>
  );
}

const sizeOf = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${String(Math.ceil(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const deadEndReason = (
  path: string,
  target: string,
  resolvesTo: CheckoutLinkDeadEnd,
): string => {
  if (resolvesTo === "directory") {
    return `${path} is a symlink to the directory ${target}.`;
  }
  if (resolvesTo === "missing") {
    return `${path} is a symlink to ${target}, which does not exist.`;
  }
  if (resolvesTo === "gitDirectory") {
    return `${path} is a symlink to ${target}, inside .git: the editor does not open it.`;
  }
  return `${path} is a symlink to ${target}, outside the repository: the editor does not open it.`;
};

interface SymlinkTargetProps {
  link: CheckoutFileLink;
  onOpenPath?: (path: string) => void;
}

/** Where a symlink leads: what is shown and saved is its target's. */
function SymlinkTarget({ link, onOpenPath }: SymlinkTargetProps): ReactNode {
  const { path } = link;
  return (
    <Text className="text-sm text-muted">
      {"Symlink to "}
      {path === null || onOpenPath === undefined ? (
        <Code className="text-sm">{link.target}</Code>
      ) : (
        <LinkText
          size="sm"
          text={link.target}
          onPress={() => {
            onOpenPath(path);
          }}
        />
      )}
    </Text>
  );
}

/** The open file as text to edit, or as its draft's diff against `HEAD`. */
export type CheckoutFileView = "diff" | "edit";

/** Why `HEAD`'s side has no text to diff against. */
const noTextAtHead: Record<"binary" | "link" | "tooLarge", string> = {
  binary: "is binary at HEAD",
  link: "is a symlink at HEAD",
  tooLarge: "is too large at HEAD to diff",
};

interface DraftDiffProps {
  path: string;
  /** the file as `HEAD` has it (`readCheckoutFileAtHead`) */
  atHead: CheckoutRead<CheckoutFileAtHead>;
  /** the editor's draft, saved or not; empty for a deleted file */
  current: string;
}

/**
 * The open file's draft against `HEAD`, computed in the page: what is typed
 * shows before it is saved, which a diff read from git cannot. A file `HEAD`
 * does not have (new, untracked) is all added. Unified, since it shares the
 * row with the tree. Scrolls inside its surface, as the editor does.
 */
function DraftDiff({ path, atHead, current }: DraftDiffProps): ReactNode {
  const mode = useCurrentMode();
  const { theme, fontFamily, wordWrap } = useDiffSettings();
  const body = ((): ReactNode => {
    const { value, error } = atHead;
    if (value === null) {
      return error === null ? (
        <Loading />
      ) : (
        <ErrorMessage>{error}</ErrorMessage>
      );
    }
    if (value.status !== "text" && value.status !== "absent") {
      return (
        <Text className="text-sm text-muted">{`No diff: ${path} ${noTextAtHead[value.status]}.`}</Text>
      );
    }
    const original = value.status === "text" ? value.source : "";
    if (original === current) {
      return (
        <Text className="text-sm text-muted">No change against HEAD.</Text>
      );
    }
    return (
      <Suspense fallback={<Loading />}>
        <DraftDiffView
          path={path}
          original={original}
          current={current}
          theme={theme}
          fontFamily={fontFamily}
          themeType={mode}
          wordWrap={wordWrap}
        />
      </Suspense>
    );
  })();
  return (
    <ScrollView className="min-h-0 flex-1" contentContainerClassName="p-xs">
      {body}
    </ScrollView>
  );
}

interface FileViewTabsProps {
  view: CheckoutFileView;
  onViewChange: (view: CheckoutFileView) => void;
}

function FileViewTabs({ view, onViewChange }: FileViewTabsProps): ReactNode {
  return (
    <Tabs
      aria-label="File view"
      value={view}
      onValueChange={(next) => {
        if (next === "edit" || next === "diff") onViewChange(next);
      }}
    >
      <Tab value="edit" label="Edit" />
      <Tab value="diff" label="Diff" />
    </Tabs>
  );
}

export interface CheckoutFileEditorProps {
  path: string;
  /** `readCheckoutFile`, read again whenever the host wants an outside change seen */
  read: CheckoutRead<CheckoutFileRead>;
  /** `saveCheckoutFile`, its refusal thrown: shown under Save */
  onSave: (
    source: string,
    expectedSource: string,
  ) => Promise<EditableFileSaveResult>;
  className?: string;
  /** the file's git state: a deleted one opens on its diff, there being nothing to edit */
  status?: CheckoutFileStatus;
  /** the file as `HEAD` has it (`readCheckoutFileAtHead`); unset, no diff is offered */
  atHead?: CheckoutRead<CheckoutFileAtHead>;
  /** editor or diff; the caller's, so it holds across files */
  view?: CheckoutFileView;
  onViewChange?: (view: CheckoutFileView) => void;
  /** opens another file of the checkout: a symlink's target; unset, the target is only named */
  onOpenPath?: (path: string) => void;
}

/**
 * One file of a checkout, edited as the text it is, in the editor its
 * extension picks (`codeLanguageOfPath`). It switches between the editor and
 * its draft's diff against `HEAD` from its header, in place; the draft is
 * kept across the switch and the diff shows it unsaved. A file that cannot be
 * shown as text (binary, too large) says so instead, and a deleted one opens
 * on its diff, there being nothing to edit. A symlink is edited as its target, which its header
 * names, and one leading to no file says where it leads. A new `read` under unsaved edits is a conflict, as
 * `EditableFile` has it: a refetch never eats what is typed. Keyed by path
 * inside, so switching files never carries a draft over.
 */
export function CheckoutFileEditor({
  path,
  read,
  onSave,
  className,
  status,
  atHead,
  view = "edit",
  onViewChange,
  onOpenPath,
}: CheckoutFileEditorProps): ReactNode {
  const columnClassName =
    className === undefined
      ? "min-h-0 flex-1 gap-xs"
      : `min-h-0 flex-1 gap-xs ${className}`;
  const tabs =
    atHead !== undefined && onViewChange !== undefined ? (
      <FileViewTabs view={view} onViewChange={onViewChange} />
    ) : null;

  /** a file with no text to edit: its reason, beside where a symlink leads */
  const unopenable = (reason: string, linkNote: ReactNode = null): ReactNode =>
    linkNote === null ? (
      <InfoMessage>{reason}</InfoMessage>
    ) : (
      <View className={columnClassName}>
        {linkNote}
        <InfoMessage>{reason}</InfoMessage>
      </View>
    );

  const { value, error, loading } = read;
  if (value === null) {
    if (error !== null) return <ErrorMessage>{error}</ErrorMessage>;
    return loading ? <Loading /> : null;
  }
  const stale =
    error === null ? null : (
      <WarningMessage>{`Could not read ${path} again: ${error}`}</WarningMessage>
    );
  if (value.status === "absent") {
    if (atHead === undefined || status !== "deleted") {
      return unopenable(`${path} no longer exists.`);
    }
    // deleted: nothing to edit, its diff is all there is to show
    return (
      <View className={columnClassName}>
        <View className="flex-row flex-wrap items-center gap-xs">
          <Code className="text-sm">{path}</Code>
          <Text className="text-sm text-muted">deleted</Text>
        </View>
        <Box className="surface min-h-0 flex-1 overflow-hidden p-0">
          <DraftDiff path={path} atHead={atHead} current="" />
        </Box>
      </View>
    );
  }
  if (value.status === "link") {
    return unopenable(deadEndReason(path, value.link.target, value.resolvesTo));
  }
  const linkNote =
    value.link === undefined ? null : (
      <SymlinkTarget link={value.link} onOpenPath={onOpenPath} />
    );
  if (value.status === "binary") {
    return unopenable(`${path} is a binary file.`, linkNote);
  }
  if (value.status === "tooLarge") {
    return unopenable(
      `${path} is ${sizeOf(value.bytes)}, past the ${sizeOf(value.limit)} the editor opens.`,
      linkNote,
    );
  }
  return (
    <View className={columnClassName}>
      {stale}
      <EditableFile
        key={path}
        fill
        lineNumbers
        path={path}
        aria-label={path}
        language={codeLanguageOfPath(path)}
        source={value.source}
        headerExtra={
          <>
            {linkNote}
            {tabs}
          </>
        }
        renderView={
          tabs !== null && atHead !== undefined && view === "diff"
            ? (draft) => (
                <DraftDiff path={path} atHead={atHead} current={draft} />
              )
            : undefined
        }
        onSave={onSave}
      />
    </View>
  );
}

interface FileListingProps {
  paths: CheckoutRead<CheckoutFilesResponse>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

function FileListing({
  paths,
  selectedPath,
  onSelect,
}: FileListingProps): ReactNode {
  const listed = paths.value;
  if (listed !== null) {
    return (
      <CheckoutFileTree
        paths={listed.paths}
        statuses={listed.statuses}
        selectedPath={selectedPath}
        onSelect={onSelect}
      />
    );
  }
  return paths.error === null ? (
    <Loading />
  ) : (
    <ErrorMessage>{paths.error}</ErrorMessage>
  );
}

/** What `CheckoutView`'s Files tab reads and does: the host's, since it decides the routes. */
export interface CheckoutFiles {
  /** `listCheckoutFiles` */
  paths: CheckoutRead<CheckoutFilesResponse>;
  /** the file open in the editor; null: none */
  selectedPath: string | null;
  onSelect: (path: string) => void;
  /** the open file's read; ignored while `selectedPath` is null */
  file: CheckoutRead<CheckoutFileRead>;
  onSave: (
    path: string,
    source: string,
    expectedSource: string,
  ) => Promise<EditableFileSaveResult>;
  /**
   * The open file as `HEAD` has it (`readCheckoutFileAtHead`): the file can
   * then switch to its draft's diff. Unset, the Files tab only edits.
   */
  fileAtHead?: CheckoutRead<CheckoutFileAtHead>;
}

/**
 * The tree beside the open file. It fills its parent: the tree virtualizes
 * in a bounded height, and the editor scrolls inside its own surface beside
 * it, so a long file never scrolls the tree, the path or the save bar away.
 * The tree is a sidebar surface and the editor another, apart on the screen's
 * ground: no separator between them.
 */
export function CheckoutFilesBody({
  paths,
  selectedPath,
  onSelect,
  file,
  onSave,
  fileAtHead,
}: CheckoutFiles): ReactNode {
  // held here, not per file: reading diffs file after file stays on the diff
  const [view, setView] = useState<CheckoutFileView>("edit");
  const status =
    selectedPath === null ? undefined : paths.value?.statuses[selectedPath];
  return (
    <View className="min-h-0 flex-1 flex-row gap-m px-m pb-m">
      <Box className="surface min-h-0 w-[280px] overflow-hidden p-xs">
        <FileListing
          paths={paths}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      </Box>
      <View className="min-h-0 min-w-0 flex-1">
        {selectedPath === null ? (
          <Text className="text-sm text-muted">
            {treeAvailable
              ? `Pick a file in the tree, or press ${goToFileShortcutLabel} to go to one.`
              : "Pick a file in the list to open it."}
          </Text>
        ) : (
          <CheckoutFileEditor
            key={selectedPath}
            path={selectedPath}
            read={file}
            status={status}
            atHead={fileAtHead}
            view={view}
            onViewChange={setView}
            onOpenPath={onSelect}
            onSave={(source, expectedSource) =>
              onSave(selectedPath, source, expectedSource)
            }
          />
        )}
      </View>
    </View>
  );
}
