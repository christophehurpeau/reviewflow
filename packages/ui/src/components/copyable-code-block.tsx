import type { CodeBlockProps } from "alouette";
import { CodeBlock, IconButton, View } from "alouette";
import { CheckRegularIcon } from "alouette-icons/phosphor-icons/Check";
import { CopyRegularIcon } from "alouette-icons/phosphor-icons/Copy";
import { WarningRegularIcon } from "alouette-icons/phosphor-icons/Warning";
import type { ReactNode } from "react";
import { useState } from "react";

type CopyState = "copied" | "failed" | "idle";

const copyFeedbackMs = 2000;

/**
 * `navigator.clipboard` exists only in a secure context, which the daemon's
 * origins are (`localhost`, `127.0.0.1`, the remote-access tunnel); native has
 * no `navigator.clipboard` at all, so there the block renders without a button
 * rather than with one that cannot work.
 */
const clipboard = (): Clipboard | undefined =>
  // oxlint-disable-next-line node-js/no-unsupported-features/node-builtins -- this runs in a browser or react-native, never node
  typeof navigator === "undefined" ? undefined : navigator.clipboard;

function CopyButton({ text }: { text: string }): ReactNode {
  const [state, setState] = useState<CopyState>("idle");
  const target = clipboard();
  if (target === undefined) return null;

  const settle = (next: CopyState): void => {
    setState(next);
    setTimeout(() => {
      setState("idle");
    }, copyFeedbackMs);
  };

  if (state === "copied") {
    return (
      <IconButton
        accent="success"
        variant="soft"
        size="sm"
        icon={<CheckRegularIcon />}
        aria-label="Copied"
      />
    );
  }

  if (state === "failed") {
    return (
      <IconButton
        accent="danger"
        variant="soft"
        size="sm"
        icon={<WarningRegularIcon />}
        aria-label="Copy failed"
      />
    );
  }

  return (
    <IconButton
      variant="soft"
      size="sm"
      icon={<CopyRegularIcon />}
      aria-label="Copy"
      onPress={() => {
        target.writeText(text).then(
          () => {
            settle("copied");
          },
          (error: unknown) => {
            console.error("copy to clipboard failed", error);
            settle("failed");
          },
        );
      }}
    />
  );
}

interface CopyableCodeBlockProps extends Omit<CodeBlockProps, "children"> {
  text: string;
}

/**
 * The button sits beside the block, not over it: alouette's `CodeBlock` is
 * display-only, and a `soft` button floated on the frame has no ground, so the
 * end of a long first line would show through its glyph.
 */
export function CopyableCodeBlock({
  text,
  ...codeBlockProps
}: CopyableCodeBlockProps): ReactNode {
  return (
    <View className="flex-row items-end gap-xxs">
      <View className="min-w-0 flex-1">
        <CodeBlock {...codeBlockProps}>{text}</CodeBlock>
      </View>
      <CopyButton text={text} />
    </View>
  );
}
