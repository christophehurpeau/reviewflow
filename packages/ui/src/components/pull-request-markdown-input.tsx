import { Box, Tab, Tabs, Text, View } from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import { MarkdownEditor } from "../editor/markdown-editor.tsx";
import type { MarkdownEditorProps } from "../slots.tsx";
import { usePullRequestSlots } from "../slots.tsx";
import { MarkdownText } from "./markdown-text.tsx";

type Mode = "preview" | "write";

interface PullRequestMarkdownInputProps {
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  autoFocus?: boolean;
}

function DefaultEditor({
  value,
  onChange,
  "aria-label": ariaLabel,
  autoFocus,
}: MarkdownEditorProps): ReactNode {
  return (
    <MarkdownEditor
      compact
      emoji
      aria-label={ariaLabel}
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the caller opens the editor from a press and asks for the focus
      autoFocus={autoFocus}
      value={value}
      onChange={onChange}
    />
  );
}

/** A component of its own, so a slot that uses hooks keeps them across tab switches. */
function EditorSlot(props: MarkdownEditorProps): ReactNode {
  const { renderMarkdownEditor } = usePullRequestSlots();
  return renderMarkdownEditor === undefined ? (
    <DefaultEditor {...props} />
  ) : (
    renderMarkdownEditor(props)
  );
}

/**
 * A body GitHub renders as markdown, written as GitHub's own box is: the
 * source in the editor slot, and a preview rendered the way the timeline
 * shows it once sent.
 */
export function PullRequestMarkdownInput({
  value,
  onChange,
  "aria-label": ariaLabel,
  autoFocus,
}: PullRequestMarkdownInputProps): ReactNode {
  const [mode, setMode] = useState<Mode>("write");

  return (
    <View className="gap-xs">
      <Tabs
        aria-label={`${ariaLabel}, write or preview`}
        value={mode}
        onValueChange={(next) => {
          setMode(next === "preview" ? "preview" : "write");
        }}
      >
        <Tab value="write" label="Write" />
        <Tab value="preview" label="Preview" />
      </Tabs>
      {mode === "write" ? (
        <EditorSlot
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- forwarded to the editor, see above
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          value={value}
          onChange={onChange}
        />
      ) : (
        <Box className="surface lowered min-h-[96px] p-m">
          {value.trim() === "" ? (
            <Text className="text-sm text-muted">Nothing to preview.</Text>
          ) : (
            <MarkdownText github text={value} />
          )}
        </Box>
      )}
    </View>
  );
}
