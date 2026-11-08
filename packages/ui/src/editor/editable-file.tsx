import {
  ActionButton,
  Button,
  Code,
  ErrorMessage,
  Text,
  View,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import { CodeEditor } from "./code-editor.tsx";
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
  language: "json" | "markdown";
  "aria-label": string;
  /** shown above the editor */
  path?: string;
  /** opens with this text instead of `source`, unsaved: a suggested edit to review */
  initialValue?: string;
  /** an offset in the opening text to put the cursor at */
  cursor?: number | null;
  className?: string;
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
}: EditableFileProps): ReactNode {
  const [lastSource, setLastSource] = useState(source);
  // what the editor opened on and Save is checked against
  const [base, setBase] = useState(source);
  const [draft, setDraft] = useState(initialValue ?? source);
  const [notice, setNotice] = useState<Notice>({ kind: "none" });

  if (source !== lastSource) {
    setLastSource(source);
    if (draft === base) {
      setDraft(source);
      setBase(source);
    } else if (source !== base) {
      setNotice({ kind: "conflict", source });
    }
  }

  const dirty = draft !== base;

  return (
    <View
      className={className === undefined ? "gap-xs" : `gap-xs ${className}`}
    >
      {path === undefined ? null : <Code className="text-sm">{path}</Code>}

      {language === "markdown" ? (
        <MarkdownEditor
          aria-label={ariaLabel}
          value={draft}
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
          value={draft}
          cursor={cursor}
          onChange={(next) => {
            setDraft(next);
            setNotice((current) =>
              current.kind === "conflict" ? current : { kind: "none" },
            );
          }}
        />
      )}

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

      <View className="flex-row flex-wrap items-center justify-end gap-xs">
        {notice.kind === "saved" && !dirty ? (
          <Text className="mr-auto text-sm text-muted">Saved.</Text>
        ) : null}
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
          disabled={!dirty || notice.kind === "conflict"}
          errorToMessage={errorToMessage}
          onPress={async () => {
            const submitted = draft;
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
          }}
        />
      </View>
    </View>
  );
}
