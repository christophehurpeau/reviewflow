import type { ReactNode } from "react";
import type { TextHighlightsProps } from "./text-highlights.tsx";

/**
 * What metro picks on a native platform: the DOM ranges and the highlight API
 * the web version stands on do not exist there, so the content is shown
 * unmarked and no selection is reported.
 */
export function TextHighlights({ children }: TextHighlightsProps): ReactNode {
  return children;
}
