import type { StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SVGIconElement } from "alouette";
import { IconButton, Tooltip, View } from "alouette";
import { CodeRegularIcon } from "alouette-icons/phosphor-icons/Code";
import { CodeBlockRegularIcon } from "alouette-icons/phosphor-icons/CodeBlock";
import { LinkSimpleRegularIcon } from "alouette-icons/phosphor-icons/LinkSimple";
import { ListBulletsRegularIcon } from "alouette-icons/phosphor-icons/ListBullets";
import { ListChecksRegularIcon } from "alouette-icons/phosphor-icons/ListChecks";
import { ListNumbersRegularIcon } from "alouette-icons/phosphor-icons/ListNumbers";
import { QuotesRegularIcon } from "alouette-icons/phosphor-icons/Quotes";
import { TextBRegularIcon } from "alouette-icons/phosphor-icons/TextB";
import { TextHOneRegularIcon } from "alouette-icons/phosphor-icons/TextHOne";
import { TextHThreeRegularIcon } from "alouette-icons/phosphor-icons/TextHThree";
import { TextHTwoRegularIcon } from "alouette-icons/phosphor-icons/TextHTwo";
import { TextItalicRegularIcon } from "alouette-icons/phosphor-icons/TextItalic";
import { TextStrikethroughRegularIcon } from "alouette-icons/phosphor-icons/TextStrikethrough";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { setLineType, toggleInlineFormat } from "./commands.ts";
import { editorFrameClasses } from "./editorFrame.ts";
import { EditorInkScope } from "./editorInkScope.tsx";
import {
  changeBetween,
  externalUpdate,
  markdownEditorExtensions,
  saveShortcut,
} from "./extensions.ts";
import type { EditorAnnotationProps } from "./useEditorAnnotations.tsx";
import { useEditorAnnotations } from "./useEditorAnnotations.tsx";
import "./markdown-editor.css";
import "./code-token-colors.css";

interface FormatButtonProps {
  icon: SVGIconElement;
  label: string;
  command: StateCommand;
  viewRef: { current: EditorView | null };
}

/** runs on the editor's own selection, then gives the focus back to it */
function FormatButton({
  icon,
  label,
  command,
  viewRef,
}: FormatButtonProps): ReactNode {
  return (
    <Tooltip
      content={label}
      render={(triggerProps) => (
        <IconButton
          {...triggerProps}
          icon={icon}
          aria-label={label}
          variant="soft"
          size="sm"
          onPress={() => {
            const view = viewRef.current;
            if (view === null) return;
            command(view);
            view.focus();
          }}
        />
      )}
    />
  );
}

function FormatToolbar({
  viewRef,
  inset,
}: {
  viewRef: { current: EditorView | null };
  /**
   * Inside the editor's surface (`fill`), lined up with the text rather than
   * the gutter: the text starts at 56px (`markdown-editor-fill`'s fixed 52px
   * gutter and the line's 4px), less the ~8px between a small icon button's
   * edge and its glyph.
   */
  inset: boolean;
}): ReactNode {
  return (
    <View
      role="toolbar"
      aria-label="Formatting"
      className={
        inset
          ? "flex-row flex-wrap items-center gap-xxs pt-xxs pr-xs pl-[48px]"
          : "flex-row flex-wrap items-center gap-xxs"
      }
    >
      <FormatButton
        icon={<TextHOneRegularIcon />}
        label="Heading 1"
        command={setLineType("h1")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<TextHTwoRegularIcon />}
        label="Heading 2"
        command={setLineType("h2")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<TextHThreeRegularIcon />}
        label="Heading 3"
        command={setLineType("h3")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<ListBulletsRegularIcon />}
        label="Bullet list"
        command={setLineType("ul")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<ListNumbersRegularIcon />}
        label="Numbered list"
        command={setLineType("ol")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<ListChecksRegularIcon />}
        label="Task list"
        command={setLineType("task")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<QuotesRegularIcon />}
        label="Quote"
        command={setLineType("quote")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<CodeBlockRegularIcon />}
        label="Code block"
        command={setLineType("code")}
        viewRef={viewRef}
      />
      {/* the line formats apart from the inline ones by space, not a rule */}
      <View aria-hidden className="w-sm" />
      <FormatButton
        icon={<TextBRegularIcon />}
        label="Bold (⌘B)"
        command={toggleInlineFormat("bold")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<TextItalicRegularIcon />}
        label="Italic (⌘I)"
        command={toggleInlineFormat("italic")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<TextStrikethroughRegularIcon />}
        label="Strikethrough (⌘⇧X)"
        command={toggleInlineFormat("strikethrough")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<CodeRegularIcon />}
        label="Inline code (⌘E)"
        command={toggleInlineFormat("code")}
        viewRef={viewRef}
      />
      <FormatButton
        icon={<LinkSimpleRegularIcon />}
        label="Link (⌘K)"
        command={toggleInlineFormat("link")}
        viewRef={viewRef}
      />
    </View>
  );
}

export interface MarkdownEditorFieldProps extends EditorAnnotationProps {
  value: string;
  /** omitted for a read-only editor */
  onChange?: (value: string) => void;
  readOnly?: boolean;
  "aria-label": string;
  /** on the column holding the toolbar and the editor, which stretches to fill it */
  className?: string;
  /** a few lines high when empty, for a comment rather than a file */
  compact?: boolean;
  /** completes GitHub's `:shortcode:` emoji */
  emoji?: boolean;
  /** read at mount, like `readOnly` */
  autoFocus?: boolean;
  /** numbers the lines in a gutter; read at mount, like `readOnly` */
  lineNumbers?: boolean;
  /**
   * Takes the height of its parent and scrolls inside, rather than growing
   * with its content for the page to scroll (`CodeEditor`'s `fill`).
   */
  fill?: boolean;
  /** ⌘S / Ctrl+S in the editor; unset, the key is the browser's */
  onSaveShortcut?: () => void;
}

/**
 * A markdown file edited as the text it is: CodeMirror with the markdown styled
 * in place and every marker left visible, ported from
 * vscode-extension-markdown-beautiful-editor. Nothing
 * is parsed into a tree and serialized back, so a save is byte for byte what
 * was typed — the property a file under git, or a template the daemon parses,
 * needs from an editor.
 *
 * **Web only.** CodeMirror owns a DOM subtree, which react-native-web cannot
 * express, so it is mounted into a raw `div`; a native build would need a
 * WebView around it. `markdown-editor.native.tsx` is what metro picks on a
 * native platform: a plain `TextArea` with the same props, so the package still
 * bundles there.
 *
 * `readOnly` is read at mount: a caller switching it remounts by key. A `value`
 * that changes under a mounted editor is applied as one change rather than a
 * remount, so the selection outside it survives, and is not reported back
 * through `onChange`.
 */
export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  "aria-label": ariaLabel,
  className,
  compact = false,
  emoji = false,
  autoFocus = false,
  lineNumbers = false,
  fill = false,
  onSaveShortcut,
  ...annotationProps
}: MarkdownEditorFieldProps): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // the view as state too, for the annotations to attach to once it exists
  const [mountedView, setMountedView] = useState<EditorView | null>(null);
  const selectionAction = useEditorAnnotations(annotationProps, mountedView);
  const emitChange = useEffectEvent((next: string) => onChange?.(next));
  const emitSave = useEffectEvent((): boolean => {
    if (onSaveShortcut === undefined) return false;
    onSaveShortcut();
    return true;
  });
  // a remount for `readOnly` starts from the value of that render, not the first
  const readValue = useEffectEvent(() => value);
  const autoFocusRef = useRef(autoFocus);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return undefined;

    const view = new EditorView({
      parent: host,
      // CodeMirror resolves its root through `assignedSlot`, so an editor slotted
      // into a shadow root (a diff annotation) would read its selection from that
      // shadow root, which does not see light DOM nodes: the cursor jumps and
      // select-all is undone. The host's own tree is where the selection lives.
      root: host.getRootNode() as Document | ShadowRoot,
      doc: readValue(),
      extensions: [
        markdownEditorExtensions({
          readOnly,
          emoji,
          lineNumbers,
          onChange: (next) => {
            emitChange(next);
          },
        }),
        saveShortcut(() => emitSave()),
        EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
      ],
    });
    viewRef.current = view;
    setMountedView(view);
    if (autoFocusRef.current) view.focus();
    return () => {
      setMountedView(null);
      view.destroy();
      viewRef.current = null;
    };
  }, [readOnly, ariaLabel, emoji, lineNumbers]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    const changes = changeBetween(view.state.doc.toString(), value);
    if (changes === null) return;
    view.dispatch({ changes, annotations: externalUpdate.of(true) });
  }, [value]);

  const columnClassName = [
    "gap-xs",
    fill ? "min-h-0 flex-1" : null,
    className ?? null,
  ]
    .filter((name) => name !== null)
    .join(" ");

  return (
    <View className={columnClassName}>
      {readOnly ? null : <FormatToolbar viewRef={viewRef} inset={fill} />}
      <EditorInkScope>
        <div
          ref={hostRef}
          className={editorFrameClasses({
            code: false,
            readOnly,
            compact,
            fill,
          })}
        >
          {selectionAction}
        </div>
      </EditorInkScope>
    </View>
  );
}
