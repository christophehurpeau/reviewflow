interface EditorFrameOptions {
  code: boolean;
  readOnly: boolean;
  compact?: boolean;
  fill: boolean;
}

/** The frame's classes (`markdown-editor.css`), shared by the code and the markdown editor. */
export const editorFrameClasses = ({
  code,
  readOnly,
  compact = false,
  fill,
}: EditorFrameOptions): string =>
  [
    "markdown-editor",
    code ? "markdown-editor-code" : null,
    readOnly ? "markdown-editor-readonly" : null,
    compact && !readOnly ? "markdown-editor-compact" : null,
    fill ? "markdown-editor-fill" : null,
  ]
    .filter((name) => name !== null)
    .join(" ");
