import type {
  DiffRefusal,
  DiffWalkthroughResponse,
  PrStatus,
  PullRequestRef,
} from "@reviewflow/sdk";
import type { Accent } from "alouette";
import type { ReactNode } from "react";
import { createContext, use } from "react";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  autoFocus?: boolean;
}

export interface WalkthroughWritingProps {
  pullRequest: PullRequestRef;
  /** the source's answer while a walkthrough is being written: `requestedAt` is set */
  response: DiffWalkthroughResponse;
  /** asks for one again; null when the source cannot */
  request: (() => Promise<void>) | null;
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
   * checkout is configured, a clone when none is (`notConfigured`). Absent:
   * the message stands alone.
   */
  renderRepositoryAction?: (
    ownerRepo: string,
    reason: RepositoryRefusalReason,
  ) => ReactNode;
  /**
   * The status badge's accent, per status, over `prStatusAccents`: an app with
   * an accent of its own for one (a theme it generates beside alouette's, cast
   * to `Accent`) passes it here.
   */
  prStatusAccents?: Partial<Record<PrStatus, Accent | undefined>>;
  /**
   * What the diff's toolbar says while a walkthrough is being written: an app
   * that knows its writer (an agent's session) shows how far it is and where
   * to watch it, and offers to ask again once it stopped without one. Absent:
   * how long ago it was asked.
   */
  renderWalkthroughWriting?: (props: WalkthroughWritingProps) => ReactNode;
}

export type RepositoryRefusalReason = DiffRefusal["reason"];

const SlotsContext = createContext<PullRequestSlots>({});

export const PullRequestSlotsProvider = SlotsContext.Provider;

export const usePullRequestSlots = (): PullRequestSlots => use(SlotsContext);
