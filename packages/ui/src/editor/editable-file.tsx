import {
  ActionButton,
  Box,
  Button,
  Code,
  ErrorMessage,
  Text,
  View,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import { CodeEditor } from "./code-editor.tsx";
import type { CodeLanguage } from "./codeEditorExtensions.ts";
import { MarkdownEditor } from "./markdown-editor.tsx";

/** What `onSave` answers; the shapes `@reviewflow/sdk/files` produces, carried over a route. */
export type EditableFileSaveResult =
  /** the file changed on disk since the editor opened it; `source` is what it holds now */
  | { status: "conflict"; source: string }
  /** shown as is; nothing was written */
  | { status: "invalid"; error: string }
  /** `source` is what is on disk now, which the editor then treats as saved */
  | { status: "saved"; source: string; warnings: string[] };

export interface EditableFileProps {
  /** what is on disk: the text the editor opens on, and what Save is checked against */
  source: string;
  /**
   * Saves `source` unless the file no longer holds `expectedSource`. A thrown
   * error (the server unreachable) is shown under the buttons.
   */
  onSave: (
    source: string,
    expectedSource: string,
  ) => Promise<EditableFileSaveResult>;
  /** `markdown` opens the markdown editor, any other the code editor (`codeLanguageOfPath`) */
  language: CodeLanguage;
  "aria-label": string;
  /** shown above the editor */
  path?: string;
  /** opens with this text instead of `source`, unsaved: a suggested edit to review */
  initialValue?: string;
  /** an offset in the opening text to put the cursor at */
  cursor?: number | null;
  className?: string;
  /** numbers the lines in the editor's gutter */
  lineNumbers?: boolean;
  /**
   * Takes its parent's height: the editor scrolls inside it, between the path
   * above and the notices and the save bar below, which stay in view.
   */
  fill?: boolean;
  /** with `fill`: beside the path in the header, e.g. a switch to another view of the file */
  headerExtra?: ReactNode;
  /**
   * With `fill`: shown in the editor's place, given the draft, e.g. the draft's
   * diff. The draft is this component's state, not the editor's, so unsaved
   * edits survive the editor being swapped out and come back with it.
   */
  renderView?: (draft: string) => ReactNode;
}

type Notice =
  | { kind: "conflict"; source: string }
  | { kind: "invalid"; error: string }
  | { kind: "none" }
  | { kind: "saved"; warnings: string[] };

/**
 * One file edited as the text it is, with the three outcomes of a save told
 * where they happen: a refusal is shown as the server worded it, warnings are
 * listed under the editor (the file is saved), and a file that changed on disk
 * offers to reload it (dropping the edits) or to keep editing (the next save
 * then replaces what is on disk, knowingly). It knows nothing about routes: the
 * caller's `onSave` does the call.
 *
 * `source` changing under a mounted editor with no unsaved edit is adopted; with
 * unsaved edits it is a conflict, as a refused save would be: a refetch never
 * eats what is being typed, and Save never overwrites the outside change
 * unknowingly.
 */
export function EditableFile({
  source,
  onSave,
  language,
  "aria-label": ariaLabel,
  path,
  initialValue,
  cursor = null,
  className,
  lineNumbers = false,
  fill = false,
  headerExtra,
  renderView,
}: EditableFileProps): ReactNode {
  const [lastSource, setLastSource] = useState(source);
  // what the editor opened on and Save is checked against
  const [base, setBase] = useState(source);
  const [draft, setDraft] = useState(initialValue ?? source);
  const [notice, setNotice] = useState<Notice>({ kind: "none" });
  // the text a save in flight wrote: read back before its answer, it is no outside change
  const [inFlight, setInFlight] = useState<string | null>(null);

  if (source !== lastSource) {
    setLastSource(source);
    if (draft === base) {
      setDraft(source);
      setBase(source);
    } else if (source === draft || source === inFlight) {
      setBase(source);
    } else if (source !== base) {
      setNotice({ kind: "conflict", source });
    }
  }

  const dirty = draft !== base;
  const savable = dirty && notice.kind !== "conflict";

  const save = async (): Promise<void> => {
    const submitted = draft;
    setInFlight(submitted);
    try {
      const result = await onSave(submitted, base);
      if (result.status === "saved") {
        setBase(result.source);
        setLastSource(result.source);
        // typed while saving: kept, and unsaved against what was saved
        setDraft((current) =>
          current === submitted ? result.source : current,
        );
        setNotice({ kind: "saved", warnings: result.warnings });
      } else if (result.status === "invalid") {
        setNotice({ kind: "invalid", error: result.error });
      } else {
        setNotice({ kind: "conflict", source: result.source });
      }
    } finally {
      setInFlight(null);
    }
  };

  // ⌘S: the button's save, without its pending state; a failure is shown as a
  // refusal would be, and a second press while one runs is dropped
  const savingRef = useRef(false);
  const saveFromShortcut = (): void => {
    if (!savable || savingRef.current) return;
    savingRef.current = true;
    save()
      .catch((error: unknown) => {
        setNotice({ kind: "invalid", error: errorToMessage(error) });
      })
      .finally(() => {
        savingRef.current = false;
      });
  };

  const columnClassName = [
    "gap-xs",
    fill ? "min-h-0 flex-1" : null,
    className ?? null,
  ]
    .filter((name) => name !== null)
    .join(" ");

  const editor =
    language === "markdown" ? (
      <MarkdownEditor
        aria-label={ariaLabel}
        lineNumbers={lineNumbers}
        fill={fill}
        value={draft}
        onSaveShortcut={saveFromShortcut}
        onChange={(next) => {
          setDraft(next);
          setNotice((current) =>
            current.kind === "conflict" ? current : { kind: "none" },
          );
        }}
      />
    ) : (
      <CodeEditor
        aria-label={ariaLabel}
        language={language}
        lineNumbers={lineNumbers}
        fill={fill}
        value={draft}
        cursor={cursor}
        onSaveShortcut={saveFromShortcut}
        onChange={(next) => {
          setDraft(next);
          setNotice((current) =>
            current.kind === "conflict" ? current : { kind: "none" },
          );
        }}
      />
    );

  const notices = (
    <>
      {notice.kind === "invalid" ? (
        <ErrorMessage>{notice.error}</ErrorMessage>
      ) : null}

      {notice.kind === "saved" && notice.warnings.length > 0 ? (
        <WarningMessage>
          <View className="gap-xxs">
            <Text className="font-body-bold text-sm">
              Saved, with{" "}
              {notice.warnings.length === 1 ? "a warning" : "warnings"}:
            </Text>
            {notice.warnings.map((warning) => (
              <Text key={warning} className="text-sm">
                {warning}
              </Text>
            ))}
          </View>
        </WarningMessage>
      ) : null}

      {notice.kind === "conflict" ? (
        <WarningMessage>
          <View className="gap-xs">
            <Text className="font-body-bold text-sm">
              The file changed on disk since it was opened.
            </Text>
            <Text className="text-sm">
              Reload to drop your edits and open what is on disk, or keep
              editing: the next save replaces what is on disk now.
            </Text>
          </View>
        </WarningMessage>
      ) : null}
    </>
  );

  const actions = (
    <>
      {notice.kind === "conflict" ? (
        <Button
          text="Reload"
          accent="neutral"
          variant="soft"
          onPress={() => {
            setBase(notice.source);
            setDraft(notice.source);
            setNotice({ kind: "none" });
          }}
        />
      ) : null}
      {notice.kind === "conflict" ? (
        <Button
          text="Keep editing"
          accent="neutral"
          variant="soft"
          onPress={() => {
            setBase(notice.source);
            setNotice({ kind: "none" });
          }}
        />
      ) : null}
      {dirty && notice.kind !== "conflict" ? (
        <Button
          text="Revert"
          accent="neutral"
          variant="soft"
          onPress={() => {
            setDraft(base);
            setNotice({ kind: "none" });
          }}
        />
      ) : null}
      <ActionButton
        text="Save"
        accent="brand"
        disabled={!savable}
        errorToMessage={errorToMessage}
        onPress={save}
      />
    </>
  );

  const saved =
    notice.kind === "saved" && !dirty ? (
      <Text className="text-sm text-muted">Saved.</Text>
    ) : null;

  if (fill) {
    // the editor is the pane: the path and the save bar head it on the
    // screen's ground, the text sits on a surface of its own, no separator
    return (
      <View className={columnClassName}>
        <View className="flex-row flex-wrap items-center gap-xs">
          {path === undefined ? null : <Code className="text-sm">{path}</Code>}
          {headerExtra}
          <View className="ml-auto flex-row flex-wrap items-center gap-xs">
            {saved}
            {actions}
          </View>
        </View>
        {notices}
        {/* p-0: `surface` pads by surface-md (p-xl); the editor insets itself */}
        <Box className="surface min-h-0 flex-1 overflow-hidden p-0">
          {renderView === undefined ? editor : renderView(draft)}
        </Box>
      </View>
    );
  }

  return (
    <View className={columnClassName}>
      {path === undefined ? null : (
        <Code className="self-start text-sm">{path}</Code>
      )}
      {editor}
      {notices}
      <View className="flex-row flex-wrap items-center justify-end gap-xs">
        {saved === null ? null : <View className="mr-auto">{saved}</View>}
        {actions}
      </View>
    </View>
  );
}
