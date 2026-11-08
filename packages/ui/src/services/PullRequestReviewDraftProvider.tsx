import type { PullRequestDraftComment } from "@reviewflow/sdk";
import type { ReactNode } from "react";
import { createContext, use, useMemo, useRef, useState } from "react";
import type { Composer } from "../components/pull-request-diff-lines.ts";
import type { PullRequestShas } from "../dataSource.ts";
import { usePullRequestDrafts } from "./PullRequestDraftsProvider.tsx";

export interface PendingComment extends PullRequestDraftComment {
  /** local only, so a draft can be edited or dropped before the review is sent */
  key: string;
}

interface PullRequestReviewDraft {
  /** the comments that go with the next review, in the order they were written */
  comments: PendingComment[];
  add: (comment: PullRequestDraftComment) => void;
  update: (key: string, body: string) => void;
  remove: (key: string) => void;
  /** after the review is sent */
  clear: () => void;
  /** the comment being written on the pull request's diff */
  composer: Composer | null;
  openComposer: (composer: Composer) => void;
  closeComposer: () => void;
  /** the range the diff shows and a review is sent on, null until known */
  shas: PullRequestShas | null;
  /** the pull request's own range, which `shas` lags once a push landed */
  latest: PullRequestShas | null;
  /** shows `latest`; null while a review is in progress */
  follow: (() => void) | null;
}

const ReviewDraftContext = createContext<PullRequestReviewDraft | null>(null);

interface PullRequestReviewDraftProviderProps {
  /** the pull request's range as last read */
  latest: PullRequestShas | null;
  children: ReactNode;
}

interface ReviewInProgress {
  comments: PendingComment[];
  composer: Composer | null;
}

/** What is kept of a review in progress between two visits. */
interface StoredReview extends ReviewInProgress {
  pinned: PullRequestShas;
}

const storedReviewKey = "review";

const isStoredReview = (value: unknown): value is StoredReview =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as StoredReview).comments) &&
  typeof (value as StoredReview).pinned?.head === "string";

/**
 * The review being written on one pull request: comments added from the diff,
 * sent together with the verdict from the header. Kept by the app's
 * `DraftStore` when it has one, with the range it was written on, so a
 * reload reopens it as it was; in memory otherwise.
 * Mounted per pull request, so drafts never leak from one to the next.
 *
 * The range is pinned to the first one known and moves only on `follow`: a
 * push swapping the diff under the reader would change the code being read
 * without saying so, move a pending comment's line onto other code, and drop a
 * comment being typed whose line left the diff. `follow` is withheld while a
 * comment is pending or being written, so the comments always go out on the
 * commit they were written on.
 */
export function PullRequestReviewDraftProvider({
  latest,
  children,
}: PullRequestReviewDraftProviderProps): ReactNode {
  const drafts = usePullRequestDrafts();
  // oxlint-disable-next-line react/hook-use-state -- read once, at mount, never set
  const [restored] = useState(() => {
    const stored = drafts?.read(storedReviewKey);
    return isStoredReview(stored) ? stored : null;
  });
  const [review, setReview] = useState<ReviewInProgress>({
    comments: restored?.comments ?? [],
    composer: restored?.composer ?? null,
  });
  // one press can make two changes ("Start a review" adds, then closes the
  // composer): each builds on the one before, not on the last render
  const current = useRef(review);
  const [pinned, setPinned] = useState<PullRequestShas | null>(
    restored?.pinned ?? latest,
  );
  if (pinned === null && latest !== null) setPinned(latest);
  const { comments, composer } = review;
  const inProgress = comments.length > 0 || composer !== null;

  const draft = useMemo<PullRequestReviewDraft>(() => {
    const change = (
      edit: (previous: ReviewInProgress) => ReviewInProgress,
    ): void => {
      const next = edit(current.current);
      current.current = next;
      setReview(next);
      const range = pinned ?? latest;
      if (drafts === null) return;
      if (
        range === null ||
        (next.comments.length === 0 && next.composer === null)
      ) {
        drafts.remove(storedReviewKey);
        return;
      }
      drafts.write(storedReviewKey, {
        ...next,
        pinned: range,
      } satisfies StoredReview);
    };

    return {
      comments,
      add: (comment) => {
        change((previous) => ({
          ...previous,
          comments: [
            ...previous.comments,
            {
              ...comment,
              key: `${String(Date.now())}-${String(previous.comments.length)}`,
            },
          ],
        }));
      },
      update: (key, body) => {
        change((previous) => ({
          ...previous,
          comments: previous.comments.map((comment) =>
            comment.key === key ? { ...comment, body } : comment,
          ),
        }));
      },
      remove: (key) => {
        change((previous) => ({
          ...previous,
          comments: previous.comments.filter((comment) => comment.key !== key),
        }));
      },
      clear: () => {
        change((previous) => ({ ...previous, comments: [] }));
      },
      composer,
      openComposer: (next) => {
        change((previous) => ({ ...previous, composer: next }));
      },
      closeComposer: () => {
        change((previous) => ({ ...previous, composer: null }));
      },
      shas: pinned ?? latest,
      latest,
      follow: inProgress
        ? null
        : () => {
            setPinned(latest);
          },
    };
  }, [comments, composer, pinned, latest, inProgress, drafts]);

  return <ReviewDraftContext value={draft}>{children}</ReviewDraftContext>;
}

export const usePullRequestReviewDraft = (): PullRequestReviewDraft => {
  const draft = use(ReviewDraftContext);
  if (draft === null) {
    throw new Error(
      "usePullRequestReviewDraft needs a PullRequestReviewDraftProvider",
    );
  }
  return draft;
};
