import type { DiffWhitespace } from "@reviewflow/sdk";
import { IconButton } from "alouette";
import { ParagraphRegularIcon } from "alouette-icons/phosphor-icons/Paragraph";
import type { ReactNode } from "react";

interface WhitespaceButtonProps {
  whitespace: DiffWhitespace;
  disabledReason?: string | null;
  onToggle: () => void;
}

/** A toggle: brand while whitespace is hidden, neutral like its neighbours otherwise. */
export function WhitespaceButton({
  whitespace,
  disabledReason,
  onToggle,
}: WhitespaceButtonProps): ReactNode {
  return (
    <IconButton
      icon={<ParagraphRegularIcon />}
      size="sm"
      accent={whitespace === "hide" ? "brand" : "neutral"}
      disabledReason={disabledReason}
      aria-label={
        whitespace === "hide"
          ? "Show whitespace changes"
          : "Hide whitespace changes"
      }
      onPress={onToggle}
    />
  );
}
