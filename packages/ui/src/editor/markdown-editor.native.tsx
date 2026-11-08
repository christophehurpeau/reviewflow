import { TextArea } from "alouette";
import type { ReactNode } from "react";
import type { MarkdownEditorFieldProps } from "./markdown-editor.tsx";

const noop = (): void => undefined;

/**
 * What metro picks on a native platform. CodeMirror needs a DOM, so the native
 * build gets a plain `TextArea` over the same props: no toolbar, no styling in
 * place, but the same text in and out.
 */
export function MarkdownEditor({
  value,
  onChange,
  readOnly = false,
  "aria-label": ariaLabel,
  autoFocus = false,
}: MarkdownEditorFieldProps): ReactNode {
  return (
    <TextArea
      aria-label={ariaLabel}
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- forwarded from the caller, as on web
      autoFocus={autoFocus}
      disabled={readOnly}
      value={value}
      onChangeText={onChange ?? noop}
    />
  );
}
