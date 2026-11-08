import type { ReactNode } from "react";
import { createContext, use } from "react";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  autoFocus?: boolean;
}

/**
 * What the host app may replace. Every slot has a default, so none is
 * required.
 */
export interface PullRequestSlots {
  /**
   * The editor of a comment, a description or a review body (the "Write" tab).
   * Defaults to the ui's own `MarkdownEditor` (a plain `TextArea` on native); an
   * app with another editor renders it here. The preview tab is always the screen's own renderer.
   */
  renderMarkdownEditor?: (props: MarkdownEditorProps) => ReactNode;
  /**
   * The action beside "this repository has no usable checkout", in the
   * attachment banner and in the refused diff: a button to the screen where the
   * checkout is configured. Absent: the message stands alone.
   */
  renderRepositoryAction?: (ownerRepo: string) => ReactNode;
}

const SlotsContext = createContext<PullRequestSlots>({});

export const PullRequestSlotsProvider = SlotsContext.Provider;

export const usePullRequestSlots = (): PullRequestSlots => use(SlotsContext);
