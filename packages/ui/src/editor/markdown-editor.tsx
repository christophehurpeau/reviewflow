import type { StateCommand } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SVGIconElement } from "alouette";
import {
  AccentScope,
  IconButton,
  ScopedTheme,
  Separator,
  Tooltip,
  View,
  useCurrentTheme,
} from "alouette";
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
import { useEffect, useEffectEvent, useRef } from "react";
import { setLineType, toggleInlineFormat } from "./commands.ts";
import {
  changeBetween,
  externalUpdate,
  markdownEditorExtensions,
} from "./extensions.ts";
import "./markdown-editor.css";

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
}: {
  viewRef: { current: EditorView | null };
}): ReactNode {
  return (
    <View
      role="toolbar"
      aria-label="Formatting"
      className="flex-row flex-wrap items-center gap-xxs"
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
      <Separator vertical className="h-[20px]" />
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

export interface MarkdownEditorFieldProps {
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
}

interface LinkInkScopeProps {
  children: ReactNode;
}

/**
 * Links are inked in the info accent, like the rendered markdown. The info
 * theme also retints the surface, borders and selection, so it is applied only
 * long enough to capture its `--color-accent` into `--md-link`, then the
 * current theme is restored around the editor.
 */
function LinkInkScope({ children }: LinkInkScopeProps): ReactNode {
  const theme = useCurrentTheme();
  return (
    <AccentScope accent="info">
      <div className="markdown-editor-link-ink">
        <ScopedTheme theme={theme}>{children}</ScopedTheme>
      </div>
    </AccentScope>
  );
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
}: MarkdownEditorFieldProps): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const emitChange = useEffectEvent((next: string) => onChange?.(next));
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
  }, [readOnly, ariaLabel, emoji]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    const changes = changeBetween(view.state.doc.toString(), value);
    if (changes === null) return;
    view.dispatch({ changes, annotations: externalUpdate.of(true) });
  }, [value]);

  return (
    <View
      className={className === undefined ? "gap-xs" : `gap-xs ${className}`}
    >
      {readOnly ? null : <FormatToolbar viewRef={viewRef} />}
      <LinkInkScope>
        <div
          ref={hostRef}
          className={(() => {
            if (readOnly) return "markdown-editor markdown-editor-readonly";
            if (compact) return "markdown-editor markdown-editor-compact";
            return "markdown-editor";
          })()}
        />
      </LinkInkScope>
    </View>
  );
}
