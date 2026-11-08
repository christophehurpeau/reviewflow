import { EditorView } from "@codemirror/view";
import { View } from "alouette";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef } from "react";
import type { CodeLanguage } from "./codeEditorExtensions.ts";
import { codeEditorExtensions } from "./codeEditorExtensions.ts";
import { changeBetween, externalUpdate } from "./extensions.ts";
import "./markdown-editor.css";
import "./code-token-colors.css";

export interface CodeEditorProps {
  value: string;
  /** omitted for a read-only editor */
  onChange?: (value: string) => void;
  language: CodeLanguage;
  readOnly?: boolean;
  "aria-label": string;
  /** on the column holding the editor, which stretches to fill it */
  className?: string;
  /** read at mount, like `readOnly` */
  autoFocus?: boolean;
  /**
   * An offset in `value` to put the cursor at, and to focus. Applied when the
   * number changes (and at mount), never on a keystroke; `null` leaves the
   * selection alone.
   */
  cursor?: number | null;
}

/**
 * Plain code (json or markdown, shown as it is) in CodeMirror, on the markdown
 * editor's base and theme. **Web only**, mounted into a raw `div` for the
 * reason `MarkdownEditor` gives; `code-editor.native.tsx` is the native
 * fallback. `readOnly` and `language` are read at mount: remount by key to
 * change them. A `value` that changes under a mounted editor is applied as one
 * change and not reported back through `onChange`.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  "aria-label": ariaLabel,
  className,
  autoFocus = false,
  cursor = null,
}: CodeEditorProps): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const emitChange = useEffectEvent((next: string) => onChange?.(next));
  const readValue = useEffectEvent(() => value);
  const autoFocusRef = useRef(autoFocus);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return undefined;
    const view = new EditorView({
      parent: host,
      // see MarkdownEditor: the selection lives in the host's own tree
      root: host.getRootNode() as Document | ShadowRoot,
      doc: readValue(),
      extensions: [
        codeEditorExtensions({
          language,
          readOnly,
          onChange: (next) => {
            emitChange(next);
          },
        }),
        EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
      ],
    });
    viewRef.current = view;
    if (autoFocusRef.current) view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, readOnly, ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    const changes = changeBetween(view.state.doc.toString(), value);
    if (changes === null) return;
    view.dispatch({ changes, annotations: externalUpdate.of(true) });
  }, [value]);

  const readCursor = useEffectEvent(() => cursor);
  useEffect(() => {
    const view = viewRef.current;
    const offset = readCursor();
    if (view === null || offset === null) return;
    view.dispatch({
      selection: { anchor: Math.min(offset, view.state.doc.length) },
      scrollIntoView: true,
    });
    view.focus();
  }, [cursor, language, readOnly, ariaLabel]);

  return (
    <View className={className}>
      <div
        ref={hostRef}
        className={
          readOnly
            ? "markdown-editor markdown-editor-code markdown-editor-readonly"
            : "markdown-editor markdown-editor-code"
        }
      />
    </View>
  );
}
