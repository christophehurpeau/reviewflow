import { TextArea } from "alouette";
import type { ReactNode } from "react";
import type { CodeEditorProps } from "./code-editor.tsx";

const noop = (): void => undefined;

/** What metro picks on a native platform: CodeMirror needs a DOM, so a plain `TextArea`. */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  "aria-label": ariaLabel,
  autoFocus = false,
}: CodeEditorProps): ReactNode {
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
