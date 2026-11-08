import type { PrReviewDecision, PrState } from "../types/entities.ts";
import type { IsoDateTime } from "../types/ids.ts";
import type { ReviewflowReviewState } from "../types/reviewflow.ts";

/**
 * One pull request, named the way GitHub names it rather than by a local
 * record: the screen opens colleagues' pull requests too.
 */
export interface PullRequestRef {
  /** `owner/repo` */
  ownerRepo: string;
  number: number;
}

export interface PullRequestPerson {
  login: string;
  avatarUrl: string | null;
}

export interface PullRequestLabel {
  name: string;
  /** six hex digits, no `#`, as GitHub stores it */
  color: string;
  description: string | null;
}

export interface PullRequestTeam {
  slug: string;
  name: string;
}

export type PullRequestRequestedReviewer =
  | { kind: "user"; login: string; avatarUrl: string | null }
  | (PullRequestTeam & { kind: "team" });

export type PullRequestReviewState =
  | "approved"
  | "changesRequested"
  | "commented"
  | "dismissed"
  | "pending";

/** The latest review of each reviewer, as GitHub folds them. */
export interface PullRequestReview {
  author: string;
  state: PullRequestReviewState;
  submittedAt: IsoDateTime | null;
}

export type PullRequestCheckOutcome = "failed" | "passed" | "pending";

export interface PullRequestCheck {
  name: string;
  outcome: PullRequestCheckOutcome;
  /**
   * A check run GitHub reports in progress. Always false for a status context:
   * its `PENDING` is the same whether the job runs or waits on an approval.
   */
  running: boolean;
  /** what the check says about itself: a status's description, a check run's title */
  description: string | null;
  url: string | null;
}

export type PullRequestFileChange =
  | "added"
  | "changed"
  | "copied"
  | "deleted"
  | "modified"
  | "renamed";

/** `dismissed`: marked viewed, then changed by a later push. */
export type PullRequestFileViewed = "dismissed" | "unviewed" | "viewed";

export interface PullRequestFile {
  path: string;
  additions: number;
  deletions: number;
  change: PullRequestFileChange;
  viewed: PullRequestFileViewed;
}

export type PullRequestMergeable = "conflicting" | "mergeable" | "unknown";

/** GitHub's `ReactionContent`, camel-cased. */
export type PullRequestReactionContent =
  | "confused"
  | "eyes"
  | "heart"
  | "hooray"
  | "laugh"
  | "rocket"
  | "thumbsDown"
  | "thumbsUp";

export interface PullRequestReaction {
  content: PullRequestReactionContent;
  /** at least 1: a content nobody reacted with is left out */
  count: number;
  viewerHasReacted: boolean;
}

/** What can be reacted to: the description, a comment, a review. */
export interface PullRequestReactable {
  /** GraphQL node id, what a reaction names */
  id: string;
  reactions: PullRequestReaction[];
  viewerCanReact: boolean;
}

export interface PullRequestComment extends PullRequestReactable {
  /** REST id, what an edit or a reply names */
  databaseId: number;
  author: PullRequestPerson;
  /** GitHub-flavoured markdown, verbatim */
  body: string;
  createdAt: IsoDateTime;
  /** null when never edited; the edits are `prRevisions`, read on a press */
  lastEditedAt: IsoDateTime | null;
  url: string;
  viewerCanUpdate: boolean;
}

export type PullRequestDiffSide = "LEFT" | "RIGHT";

/** A thread on the code; `line`/`startLine` are in `side`'s file, as GitHub numbers them. */
export interface PullRequestThread {
  kind: "thread";
  /** GraphQL node id, what resolving names */
  id: string;
  path: string;
  /** null when the line is gone from the diff (an outdated thread) */
  line: number | null;
  /** the first line of a multi-line comment; null for a single line */
  startLine: number | null;
  side: PullRequestDiffSide;
  /** the side of `startLine`; null for a single line */
  startSide: PullRequestDiffSide | null;
  /** the line when the thread was opened, kept for an outdated thread */
  originalLine: number | null;
  originalStartLine: number | null;
  resolved: boolean;
  outdated: boolean;
  viewerCanResolve: boolean;
  viewerCanUnresolve: boolean;
  viewerCanReply: boolean;
  /** the diff lines above the comment, as GitHub kept them */
  diffHunk: string;
  comments: PullRequestComment[];
  /** every comment of the thread, `comments` included */
  commentsTotal: number;
  createdAt: IsoDateTime;
}

/** What happened to the pull request, as GitHub's page lists it between comments. */
export type PullRequestEventAction =
  | "assigned"
  | "autoMergeDisabled"
  | "autoMergeEnabled"
  | "baseRefChanged"
  | "closed"
  | "committed"
  | "convertedToDraft"
  | "headRefForcePushed"
  | "labeled"
  | "merged"
  | "readyForReview"
  | "renamed"
  | "reopened"
  | "reviewDismissed"
  | "reviewRequested"
  | "reviewRequestRemoved"
  | "unassigned"
  | "unlabeled";

export interface PullRequestEvent {
  kind: "event";
  action: PullRequestEventAction;
  /** null for a deleted account, or a push with no GitHub user */
  actor: PullRequestPerson | null;
  /**
   * What the action names, ready to read: the reviewer or team asked, the
   * assignee, the label, the commit's headline, the new title, the new base.
   */
  subject: string | null;
  /** `labeled` and `unlabeled`: the label, for its colour */
  label: PullRequestLabel | null;
  /**
   * The second thing some actions name: a commit's or a force-push's short
   * sha, the previous title of `renamed`, the previous base of `baseRefChanged`.
   */
  detail: string | null;
  createdAt: IsoDateTime;
}

export interface PullRequestReviewItem extends PullRequestReactable {
  kind: "review";
  databaseId: number;
  author: PullRequestPerson;
  state: PullRequestReviewState;
  body: string;
  createdAt: IsoDateTime;
  lastEditedAt: IsoDateTime | null;
  url: string;
  viewerCanUpdate: boolean;
  /** the head the review was made on */
  commitOid: string | null;
}

/**
 * The conversation as GitHub's page shows it, oldest first: comments, reviews
 * that said something (a verdict or a body), threads on the code, and events.
 */
export type PullRequestTimelineItem =
  | PullRequestEvent
  | PullRequestReviewItem
  | PullRequestThread
  | (PullRequestComment & { kind: "comment" });

export interface PullRequestCommit {
  oid: string;
  /** the first parent: with `oid`, the commit's own diff; null for a root commit */
  parentOid: string | null;
  /** more than one parent: its diff against `parentOid` carries what was merged in */
  merge: boolean;
  /** the message's first line */
  headline: string;
  /** the rest of the message, empty when there is none */
  body: string;
  /** the GitHub user, else the git author's name with no avatar */
  author: PullRequestPerson | null;
  committedAt: IsoDateTime;
}

/** GitHub's `mergeStateStatus`, lowercased: why a merge is or is not offered. */
export type PullRequestMergeState =
  | "behind"
  | "blocked"
  | "clean"
  | "dirty"
  | "draft"
  | "hasHooks"
  | "unknown"
  | "unstable";

export type PullRequestMergeMethod = "merge" | "rebase" | "squash";

/** A rebase replays the commits as they are: it writes no commit of its own. */
export type PullRequestCommittingMergeMethod = Exclude<
  PullRequestMergeMethod,
  "rebase"
>;

export interface PullRequestMergeCommitMessage {
  title: string;
  body: string;
}

/** `id` is also what the draft and viewed mutations name; the reactions are the description's. */
export interface PullRequestDetail
  extends PullRequestRef, PullRequestReactable {
  url: string;
  title: string;
  /** GitHub-flavoured markdown, verbatim */
  body: string;
  state: PrState;
  author: PullRequestPerson | null;
  headRef: string;
  baseRef: string;
  headSha: string;
  /** the base branch's tip as GitHub holds it; with `headSha`, what the diff is */
  baseSha: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** the description's last edit, null when never edited */
  lastEditedAt: IsoDateTime | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeable: PullRequestMergeable;
  mergeState: PullRequestMergeState;
  /** what the repository allows, GitHub's default first */
  mergeMethods: PullRequestMergeMethod[];
  /** what GitHub prefills in its own merge box for the viewer, per method */
  mergeCommitMessages: Record<
    PullRequestCommittingMergeMethod,
    PullRequestMergeCommitMessage
  >;
  /** title, body, labels, assignees, state: GitHub's own answer for the viewer */
  viewerCanUpdate: boolean;
  /** "Update branch" is offered: the base moved and the head can take it */
  viewerCanUpdateBranch: boolean;
  /** the viewer may commit a suggestion to the head branch */
  viewerCanApplySuggestion: boolean;
  reviewDecision: PrReviewDecision;
  labels: PullRequestLabel[];
  assignees: PullRequestPerson[];
  requestedReviewers: PullRequestRequestedReviewer[];
  reviews: PullRequestReview[];
  commitsTotal: number;
}

/** One read of one part of a pull request. */
export interface PullRequestRead {
  /** when the source answered: the age of what is shown */
  fetchedAt: IsoDateTime;
  /**
   * when the app last knew it current: the answer itself, or later, reviewflow
   * reporting nothing this part shows changed since
   */
  checkedAt: IsoDateTime;
  /** `reviewflow`: read from reviewflow's copy (the checks), not from GitHub */
  source: "github" | "reviewflow";
  /** what GitHub refused next to a usable answer, verbatim */
  errors: string[];
}

/** The header, the sidebar and the merge box: what every tab shows. */
/**
 * Each image url a body wrote, to the camo url GitHub serves it from: see
 * `imageProxiesOf`. Absent from a source that does not render GitHub's html.
 */
export type PullRequestImageProxies = Record<string, string>;

export interface PullRequestDetailResponse extends PullRequestRead {
  pullRequest: PullRequestDetail;
  /** the `gh` login, whose turn the screen reads gestures for */
  viewer: string;
  /** the images of the description */
  images?: PullRequestImageProxies;
}

export interface PullRequestChecksResponse extends PullRequestRead {
  /** the head commit's checks, up to the first page */
  checks: PullRequestCheck[];
  /** every check of the head commit, `checks` included */
  checksTotal: number;
}

export interface PullRequestTimelineResponse extends PullRequestRead {
  timeline: PullRequestTimelineItem[];
  /** the images of every comment and review of `timeline` */
  images?: PullRequestImageProxies;
  /** older items past the page read, left out of `timeline` (the newest are kept) */
  timelineTruncated: boolean;
}

export interface PullRequestCommitsResponse extends PullRequestRead {
  /** oldest first, up to the first page; `commitsTotal` is the total */
  commits: PullRequestCommit[];
}

/** The viewer's newest submitted review, whatever its verdict. */
export interface PullRequestViewerLastReview {
  /** the head it was submitted on: "changes since my last review" start there */
  oid: string;
  submittedAt: string | null;
}

export interface PullRequestFilesResponse extends PullRequestRead {
  /** up to the first page; `changedFiles` is the total */
  files: PullRequestFile[];
  viewerLastReview: PullRequestViewerLastReview | null;
}

export interface PullRequestPartResponses {
  detail: PullRequestDetailResponse;
  checks: PullRequestChecksResponse;
  timeline: PullRequestTimelineResponse;
  commits: PullRequestCommitsResponse;
  files: PullRequestFilesResponse;
}

export type PullRequestPart = keyof PullRequestPartResponses;

/**
 * `GET /api/prs/detail?repo=<owner/repo>&number=<n>&part=<part>` — one part of
 * a pull request, read from GitHub when the screen asks for it and never
 * polled. Each is its own query so the screen waits for none it
 * does not show: GitHub resolves a query's fields one after the other.
 *
 * The answer is kept as the pull request's last read, served by `prCached`.
 */
export type PullRequestPartResponse<Part extends PullRequestPart> =
  PullRequestPartResponses[Part];

/**
 * `GET /api/prs/cached?repo=<owner/repo>&number=<n>` — the last read of each
 * part, from the daemon's database, shown while GitHub is read again. Never
 * served as current: `fetchedAt` says how old each part is.
 */
export interface PullRequestCachedResponse {
  parts: Partial<PullRequestPartResponses>;
}

/**
 * A `pullRequestChanged` frame on `/api/events`: reviewflow reported a change
 * of this pull request, and these parts of its screen are stale.
 */
export interface PullRequestChange extends PullRequestRef {
  parts: PullRequestPart[];
}

/**
 * `POST /api/prs/cache/clear` — drops the last read of every pull request:
 * the next opening of each waits for GitHub, as a first one does.
 */
export interface ClearPullRequestCacheResponse {
  /** pull requests whose last read was dropped */
  cleared: number;
}

/**
 * What reviewflow holds of a pull request, enough to head the screen while
 * GitHub is read. Never a substitute for the detail: no body, no timeline.
 */
export interface PullRequestSummary extends PullRequestRef {
  title: string;
  url: string;
  state: PrState | null;
  reviewState: ReviewflowReviewState | null;
  author: string | null;
  headRef: string | null;
  baseRef: string | null;
  /** null until reviewflow knows it; with `baseSha`, enough to read the diff early */
  headSha: string | null;
  baseSha: string | null;
}

/**
 * `GET /api/prs/summary?repo=<owner/repo>&number=<n>` — reviewflow's copy, null
 * without a token, for a pull request reviewflow never handled, or when it
 * cannot be reached: the screen then waits for the detail, as it always did.
 */
export interface PullRequestSummaryResponse {
  summary: PullRequestSummary | null;
}

/**
 * `GET /api/prs/candidates?repo=<owner/repo>&number=<n>` — what the editors
 * offer, read apart from the detail so the screen does not wait for them: the
 * repository's assignable users alone cost GitHub about half a second.
 */
export interface PullRequestCandidatesResponse {
  /** what the label editor offers */
  repoLabels: PullRequestLabel[];
  /**
   * GitHub's suggested reviewers, in GitHub's order. Neither list holds the
   * author — GitHub refuses a review request to the author.
   */
  suggestedReviewers: PullRequestPerson[];
  /** the repository's assignable users not suggested, by login */
  reviewerCandidates: PullRequestPerson[];
  /**
   * The organisation's teams the viewer can see, by name; empty for a
   * repository a user owns.
   */
  teamCandidates: PullRequestTeam[];
  /** the repository's assignable users, the author included */
  assigneeCandidates: PullRequestPerson[];
  /** what GitHub refused next to a usable answer, verbatim */
  errors: string[];
}

export interface PullRequestTextLine {
  kind: "added" | "context" | "removed";
  text: string;
}

/** One version of a description, a comment or a review, as GitHub keeps it. */
export interface PullRequestRevision {
  editedAt: IsoDateTime;
  /** null for a deleted account */
  editor: PullRequestPerson | null;
  /** the text as first posted */
  original: boolean;
  /** the whole text of this version; null once its author deleted it from the history */
  body: string | null;
  deletedBy: string | null;
  /**
   * Against the next older revision listed with a text, every line kept; null
   * when there is none (the original, or the oldest listed).
   */
  changes: PullRequestTextLine[] | null;
}

/**
 * `GET /api/prs/revisions?repo=<owner/repo>&number=<n>&subject=<id>` — the
 * edit history of a `PullRequestReactable`'s `id`, read from GitHub on a press
 * and never kept: the timeline carries only `lastEditedAt`, since every
 * version of every comment would weigh the query far more than it is opened.
 */
export interface PullRequestRevisionsResponse {
  /** newest first, up to the first page */
  revisions: PullRequestRevision[];
  /** every revision, the original included when GitHub kept it */
  revisionsTotal: number;
}

/**
 * One change per request, so a refusal names the change it refused. Labels and
 * reviewers carry both directions because the editor submits a selection, and
 * the difference is what GitHub is asked for.
 */
export type PullRequestEdit =
  | {
      kind: "applySuggestions";
      /** refused when the head moved since the screen read it */
      expectedHeadSha: string;
      /** one commit for all of them, as GitHub's batch */
      suggestions: PullRequestSuggestionRef[];
      headline: string;
      /** the daemon appends a `Co-authored-by` trailer per suggester */
      body: string;
    }
  | {
      kind: "editComment";
      target: "issueComment" | "review" | "reviewComment";
      databaseId: number;
      body: string;
    }
  | {
      kind: "inlineComment";
      commitId: string;
      comment: PullRequestDraftComment;
    }
  | {
      kind: "merge";
      method: PullRequestMergeMethod;
      /** refused by GitHub when the head moved since the screen read it */
      expectedHeadSha: string;
      /** absent: GitHub writes its own; never with a rebase */
      commitMessage?: PullRequestMergeCommitMessage;
    }
  | {
      kind: "reaction";
      /** a `PullRequestReactable`'s `id` */
      subjectId: string;
      content: PullRequestReactionContent;
      /** false removes the viewer's own reaction */
      reacted: boolean;
    }
  | {
      kind: "reply";
      /** the `databaseId` of a comment of the thread */
      inReplyTo: number;
      body: string;
    }
  | {
      kind: "review";
      event: PullRequestReviewEvent;
      body: string;
      /** the head the review is about; GitHub refuses one that is not the PR's */
      commitId: string;
      comments: PullRequestDraftComment[];
    }
  | {
      kind: "reviewers";
      /** a login that already reviewed is asked again: GitHub's re-request */
      add: string[];
      remove: string[];
      /** team slugs */
      addTeams: string[];
      removeTeams: string[];
    }
  | { kind: "assignees"; add: string[]; remove: string[] }
  | { kind: "body"; body: string }
  | { kind: "comment"; body: string }
  | { kind: "draft"; draft: boolean }
  | { kind: "labels"; add: string[]; remove: string[] }
  | { kind: "resolveThread"; threadId: string; resolved: boolean }
  | { kind: "state"; state: "closed" | "open" }
  | { kind: "title"; title: string }
  | { kind: "updateBranch"; expectedHeadSha: string }
  | { kind: "viewed"; path: string; viewed: boolean };

export type PullRequestReviewEvent = "approve" | "comment" | "requestChanges";

/**
 * A comment on lines of the diff, before it is sent: alone (`inlineComment`)
 * or with a review. A suggestion is a ```` ```suggestion ```` block in `body`.
 */
export interface PullRequestDraftComment {
  path: string;
  side: PullRequestDiffSide;
  line: number;
  /** the first line of a range, on `startSide`; null for one line */
  startLine: number | null;
  startSide: PullRequestDiffSide | null;
  body: string;
}

/**
 * `POST /api/prs/edit` — writes to GitHub under the operator's `gh` login, the
 * one route that does. The answer carries no pull request: the screen reads it
 * again, so what it shows is GitHub's state rather than the request echoed.
 */
export interface EditPullRequestRequest extends PullRequestRef {
  edit: PullRequestEdit;
}

/** A suggestion is committed from its comment, on its thread's lines. */
export interface PullRequestSuggestionRef {
  threadId: string;
  /** the comment's GraphQL node id */
  commentId: string;
}

export interface EditPullRequestResponse {
  edited: PullRequestEdit["kind"];
  /**
   * What failed past GitHub's write, which landed: resolving the threads of
   * committed suggestions. Null otherwise.
   */
  followUpError: string | null;
}
