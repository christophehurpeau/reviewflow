import type {
  PullRequestCandidatesResponse,
  PullRequestCheck,
  PullRequestChecksResponse,
  PullRequestComment,
  PullRequestCommit,
  PullRequestCommitsResponse,
  PullRequestDetail,
  PullRequestDetailResponse,
  PullRequestDiffSide,
  PullRequestEvent,
  PullRequestEventAction,
  PullRequestFile,
  PullRequestFileChange,
  PullRequestFileViewed,
  PullRequestFilesResponse,
  PullRequestLabel,
  PullRequestMergeMethod,
  PullRequestMergeState,
  PullRequestMergeable,
  PullRequestPart,
  PullRequestPartResponse,
  PullRequestPerson,
  PullRequestReactable,
  PullRequestReactionContent,
  PullRequestRead,
  PullRequestRef,
  PullRequestRequestedReviewer,
  PullRequestReviewState,
  PullRequestTimelineItem,
  PullRequestTimelineResponse,
  PullRequestViewerLastReview,
} from "../api/pullRequest.ts";
import type { PrReviewDecision } from "../types/entities.ts";
import { imageProxiesOf, mergeImageProxies } from "./imageProxies.ts";
import { checkOutcomes, splitOwnerRepo } from "./prQuery.ts";
import type { GitHubTransport } from "./transport.ts";

const timelineItemTypes = [
  "ISSUE_COMMENT",
  "PULL_REQUEST_REVIEW",
  "PULL_REQUEST_COMMIT",
  "ASSIGNED_EVENT",
  "UNASSIGNED_EVENT",
  "LABELED_EVENT",
  "UNLABELED_EVENT",
  "REVIEW_REQUESTED_EVENT",
  "REVIEW_REQUEST_REMOVED_EVENT",
  "CLOSED_EVENT",
  "REOPENED_EVENT",
  "MERGED_EVENT",
  "READY_FOR_REVIEW_EVENT",
  "CONVERT_TO_DRAFT_EVENT",
  "HEAD_REF_FORCE_PUSHED_EVENT",
  "BASE_REF_CHANGED_EVENT",
  "RENAMED_TITLE_EVENT",
  "REVIEW_DISMISSED_EVENT",
  "AUTO_MERGE_ENABLED_EVENT",
  "AUTO_MERGE_DISABLED_EVENT",
].join(", ");

const assigneeFields =
  "__typename ... on User { login } ... on Bot { login } ... on Mannequin { login } ... on Organization { login }";

const reviewerFields =
  "__typename ... on User { login } ... on Bot { login } ... on Mannequin { login } ... on Team { name }";

/** What a description, a comment or a review carries to be reacted to. */
const reactionFields =
  "viewerCanReact reactionGroups { content viewerHasReacted reactors { totalCount } }";

const pullRequestQuery = ({
  name,
  viewer = false,
  repositoryFields = "",
  fields,
}: {
  name: string;
  viewer?: boolean;
  repositoryFields?: string;
  fields: string;
}): string => `query ${name}($owner: String!, $name: String!, $number: Int!) {${viewer ? "\n  viewer { login }" : ""}
  repository(owner: $owner, name: $name) {${repositoryFields}
    pullRequest(number: $number) {${fields}
    }
  }
}`;

/**
 * The pull request is read in parts, each its own query sent at the same time
 * or when its tab opens: GitHub resolves a query's fields one after the other,
 * so one document holding everything cost the sum of its connections — 1.4 to
 * 1.8s, where the header alone answers in 0.6 to 0.8s. What the editors offer
 * is `pullRequestCandidatesQuery`, apart for the same reason.
 *
 * Every connection stops at its first page. 100 files and 100 checks cover the
 * pull requests a person reviews; past that the totals are still exact and the
 * screen says how many it does not list. The timeline keeps the newest 100
 * items (`last`), since the recent conversation is what a reviewer needs.
 */
export const pullRequestDetailQuery = pullRequestQuery({
  name: "PullRequestDetail",
  viewer: true,
  repositoryFields: `
    mergeCommitAllowed
    squashMergeAllowed
    rebaseMergeAllowed
    viewerDefaultMergeMethod`,
  fields: `
      id
      number
      url
      title
      body
      bodyHTML
      state
      isDraft
      author { login avatarUrl }
      headRefName
      baseRefName
      headRefOid
      baseRefOid
      createdAt
      updatedAt
      lastEditedAt
      additions
      deletions
      changedFiles
      mergeable
      mergeStateStatus
      viewerCanUpdate
      viewerCanUpdateBranch
      viewerCanApplySuggestion
      mergeCommitHeadline: viewerMergeHeadlineText(mergeType: MERGE)
      mergeCommitBody: viewerMergeBodyText(mergeType: MERGE)
      squashCommitHeadline: viewerMergeHeadlineText(mergeType: SQUASH)
      squashCommitBody: viewerMergeBodyText(mergeType: SQUASH)
      ${reactionFields}
      reviewDecision
      labels(first: 50) { nodes { name color description } }
      assignees(first: 20) { nodes { login avatarUrl } }
      reviewRequests(first: 50) {
        nodes {
          requestedReviewer {
            __typename
            ... on User { login avatarUrl }
            ... on Bot { login avatarUrl }
            ... on Mannequin { login avatarUrl }
            ... on Team { slug name }
          }
        }
      }
      latestReviews(first: 50) { nodes { author { login } state submittedAt } }
      commits { totalCount }`,
});

export const pullRequestChecksQuery = pullRequestQuery({
  name: "PullRequestChecks",
  fields: `
      headCommits: commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 100) {
                totalCount
                nodes {
                  __typename
                  ... on CheckRun { name status conclusion title detailsUrl }
                  ... on StatusContext { context state description targetUrl }
                }
              }
            }
          }
        }
      }`,
});

export const pullRequestTimelineQuery = pullRequestQuery({
  name: "PullRequestTimeline",
  fields: `
      timelineItems(last: 100, itemTypes: [${timelineItemTypes}]) {
        filteredCount
        pageInfo { hasPreviousPage }
        nodes {
          __typename
          ... on IssueComment {
            id databaseId author { login avatarUrl } body bodyHTML createdAt lastEditedAt url viewerCanUpdate
            ${reactionFields}
          }
          ... on PullRequestReview {
            id databaseId author { login avatarUrl } state body bodyHTML submittedAt createdAt lastEditedAt url
            viewerCanUpdate
            ${reactionFields}
            commit { oid }
          }
          ... on PullRequestCommit {
            commit {
              abbreviatedOid
              messageHeadline
              committedDate
              author { name user { login avatarUrl } }
            }
          }
          ... on AssignedEvent { createdAt actor { login avatarUrl } assignee { ${assigneeFields} } }
          ... on UnassignedEvent { createdAt actor { login avatarUrl } assignee { ${assigneeFields} } }
          ... on LabeledEvent { createdAt actor { login avatarUrl } label { name color description } }
          ... on UnlabeledEvent { createdAt actor { login avatarUrl } label { name color description } }
          ... on ReviewRequestedEvent { createdAt actor { login avatarUrl } requestedReviewer { ${reviewerFields} } }
          ... on ReviewRequestRemovedEvent { createdAt actor { login avatarUrl } requestedReviewer { ${reviewerFields} } }
          ... on ClosedEvent { createdAt actor { login avatarUrl } }
          ... on ReopenedEvent { createdAt actor { login avatarUrl } }
          ... on MergedEvent { createdAt actor { login avatarUrl } }
          ... on ReadyForReviewEvent { createdAt actor { login avatarUrl } }
          ... on ConvertToDraftEvent { createdAt actor { login avatarUrl } }
          ... on AutoMergeEnabledEvent { createdAt actor { login avatarUrl } }
          ... on AutoMergeDisabledEvent { createdAt actor { login avatarUrl } }
          ... on HeadRefForcePushedEvent { createdAt actor { login avatarUrl } afterCommit { abbreviatedOid } }
          ... on BaseRefChangedEvent { createdAt actor { login avatarUrl } currentRefName previousRefName }
          ... on RenamedTitleEvent { createdAt actor { login avatarUrl } currentTitle previousTitle }
          ... on ReviewDismissedEvent { createdAt actor { login avatarUrl } review { author { login } } }
        }
      }
      reviewThreads(first: 100) {
        totalCount
        nodes {
          id
          isResolved
          resolvedBy { login avatarUrl }
          isOutdated
          path
          line
          startLine
          diffSide
          startDiffSide
          originalLine
          originalStartLine
          viewerCanResolve
          viewerCanUnresolve
          viewerCanReply
          comments(first: 20) {
            totalCount
            nodes {
              id databaseId author { login avatarUrl } body bodyHTML createdAt lastEditedAt url diffHunk viewerCanUpdate
              ${reactionFields}
            }
          }
        }
      }`,
});

export const pullRequestCommitsQuery = pullRequestQuery({
  name: "PullRequestCommits",
  fields: `
      commits(first: 100) {
        totalCount
        nodes {
          commit {
            oid
            parents(first: 1) { totalCount nodes { oid } }
            messageHeadline
            messageBody
            committedDate
            author { name user { login avatarUrl } }
          }
        }
      }`,
});

/**
 * The viewed marks change with no event on the pull request: read with the tab.
 * The viewer's last review is found among `latestReviews` — one per author,
 * pending ones left out — rather than the last page of every review, where a
 * busy pull request pushed it out of reach.
 */
export const pullRequestFilesQuery = pullRequestQuery({
  name: "PullRequestFiles",
  fields: `
      files(first: 100) {
        nodes { path additions deletions changeType viewerViewedState }
      }
      latestReviews(first: 100) {
        nodes { viewerDidAuthor submittedAt commit { oid } }
      }`,
});

type GhActor = GhPerson;

interface GhLabel {
  name: string;
  color: string;
  description: string | null;
}

type GhRequestedReviewer =
  | {
      __typename: "Bot" | "Mannequin" | "User";
      login: string;
      avatarUrl: string | null;
    }
  | { __typename: "Team"; slug: string; name: string };

type GhCheckContext =
  | {
      __typename: "CheckRun";
      name: string;
      status: string;
      conclusion: string | null;
      title: string | null;
      detailsUrl: string | null;
    }
  | {
      __typename: "StatusContext";
      context: string;
      state: string;
      description: string | null;
      targetUrl: string | null;
    };

interface GhPerson {
  login: string;
  avatarUrl?: string | null;
}

interface GhReactionGroup {
  content: string;
  viewerHasReacted: boolean;
  reactors: { totalCount: number };
}

interface GhReactable {
  id: string;
  viewerCanReact: boolean;
  reactionGroups: GhReactionGroup[] | null;
}

interface GhComment extends GhReactable {
  databaseId: number;
  author: GhPerson | null;
  body: string;
  /** absent from the queries that do not ask it */
  bodyHTML?: string;
  createdAt: string;
  lastEditedAt: string | null;
  url: string;
  viewerCanUpdate: boolean;
}

interface GhConnection<Node> {
  totalCount: number;
  nodes: (Node | null)[] | null;
}

interface GhReview extends GhComment {
  state: string;
  submittedAt: string | null;
  commit: { oid: string } | null;
}

interface GhReviewThread {
  id: string;
  isResolved: boolean;
  resolvedBy: GhActor | null;
  isOutdated: boolean;
  path: string;
  line: number | null;
  startLine: number | null;
  diffSide: string;
  startDiffSide: string | null;
  originalLine: number | null;
  originalStartLine: number | null;
  viewerCanResolve: boolean;
  viewerCanUnresolve: boolean;
  viewerCanReply: boolean;
  comments: GhConnection<GhComment & { diffHunk: string }>;
}

interface GhCommit {
  oid: string;
  parents: { totalCount: number; nodes: ({ oid: string } | null)[] | null };
  messageHeadline: string;
  messageBody: string;
  committedDate: string;
  author: { name: string | null; user: GhActor | null } | null;
}

interface GhEventBase {
  createdAt: string;
  actor: GhActor | null;
}

type GhNamed = { login: string } | { name: string } | null;

type GhTimelineNode =
  | {
      __typename: "PullRequestCommit";
      commit: Pick<GhCommit, "author" | "committedDate" | "messageHeadline"> & {
        abbreviatedOid: string;
      };
    }
  | (GhComment & { __typename: "IssueComment" })
  | (GhEventBase & {
      __typename:
        | "AutoMergeDisabledEvent"
        | "AutoMergeEnabledEvent"
        | "ClosedEvent"
        | "ConvertToDraftEvent"
        | "MergedEvent"
        | "ReadyForReviewEvent"
        | "ReopenedEvent";
    })
  | (GhEventBase & {
      __typename: "AssignedEvent" | "UnassignedEvent";
      assignee: GhNamed;
    })
  | (GhEventBase & {
      __typename: "BaseRefChangedEvent";
      currentRefName: string;
      previousRefName: string;
    })
  | (GhEventBase & {
      __typename: "HeadRefForcePushedEvent";
      afterCommit: { abbreviatedOid: string } | null;
    })
  | (GhEventBase & {
      __typename: "LabeledEvent" | "UnlabeledEvent";
      label: GhLabel | null;
    })
  | (GhEventBase & {
      __typename: "RenamedTitleEvent";
      currentTitle: string;
      previousTitle: string;
    })
  | (GhEventBase & {
      __typename: "ReviewDismissedEvent";
      review: { author: { login: string } | null } | null;
    })
  | (GhEventBase & {
      __typename: "ReviewRequestedEvent" | "ReviewRequestRemovedEvent";
      requestedReviewer: GhNamed;
    })
  | (GhReview & { __typename: "PullRequestReview" });

export interface GhPullRequestDetail extends GhReactable {
  number: number;
  url: string;
  title: string;
  body: string;
  bodyHTML?: string;
  state: string;
  isDraft: boolean;
  author: GhActor | null;
  headRefName: string;
  baseRefName: string;
  headRefOid: string;
  baseRefOid: string;
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeable: string;
  mergeStateStatus: string;
  viewerCanUpdate: boolean;
  viewerCanUpdateBranch: boolean;
  viewerCanApplySuggestion: boolean;
  mergeCommitHeadline: string;
  mergeCommitBody: string;
  squashCommitHeadline: string;
  squashCommitBody: string;
  reviewDecision: string | null;
  labels: { nodes: (GhLabel | null)[] | null } | null;
  assignees: { nodes: (GhActor | null)[] | null } | null;
  reviewRequests: {
    nodes: ({ requestedReviewer: GhRequestedReviewer | null } | null)[] | null;
  } | null;
  latestReviews: {
    nodes:
      | ({
          author: { login: string } | null;
          state: string;
          submittedAt: string | null;
        } | null)[]
      | null;
  } | null;
  commits: { totalCount: number };
}

export interface GhPullRequestChecks {
  headCommits: {
    nodes:
      | ({
          commit: {
            statusCheckRollup: {
              contexts: {
                totalCount: number;
                nodes: (GhCheckContext | null)[] | null;
              };
            } | null;
          };
        } | null)[]
      | null;
  };
}

export interface GhPullRequestTimeline {
  timelineItems: {
    filteredCount: number;
    pageInfo: { hasPreviousPage: boolean };
    nodes: (GhTimelineNode | null)[] | null;
  } | null;
  reviewThreads: GhConnection<GhReviewThread> | null;
}

export interface GhPullRequestCommits {
  commits: GhConnection<{ commit: GhCommit }>;
}

export interface GhPullRequestFiles {
  files: {
    nodes:
      | ({
          path: string;
          additions: number;
          deletions: number;
          changeType: string;
          viewerViewedState: string;
        } | null)[]
      | null;
  } | null;
  latestReviews: {
    nodes:
      | ({
          viewerDidAuthor: boolean;
          submittedAt: string | null;
          commit: { oid: string } | null;
        } | null)[]
      | null;
  } | null;
}

interface GhMergeSettings {
  mergeCommitAllowed?: boolean;
  squashMergeAllowed?: boolean;
  rebaseMergeAllowed?: boolean;
  viewerDefaultMergeMethod?: string | null;
}

/** What a part's query answers: `viewer` and the merge settings for the header alone. */
export interface PullRequestPartData<GhPart> {
  viewer?: { login: string } | null;
  repository: (GhMergeSettings & { pullRequest: GhPart | null }) | null;
}

export type PullRequestDetailData = PullRequestPartData<GhPullRequestDetail>;

const present = <Item>(items: (Item | null)[] | null | undefined): Item[] =>
  (items ?? []).filter((item): item is Item => item !== null);

const toPerson = ({ login, avatarUrl }: GhActor): PullRequestPerson => ({
  login,
  avatarUrl: avatarUrl ?? null,
});

const toLabel = ({ name, color, description }: GhLabel): PullRequestLabel => ({
  name,
  color,
  description: description === "" ? null : description,
});

const toState = (
  state: string,
  isDraft: boolean,
): PullRequestDetailResponse["pullRequest"]["state"] => {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return isDraft ? "draft" : "open";
};

const reviewDecisions = new Map<string, PrReviewDecision>([
  ["APPROVED", "approved"],
  ["CHANGES_REQUESTED", "changesRequested"],
  ["REVIEW_REQUIRED", "reviewRequired"],
]);

const mergeables = new Map<string, PullRequestMergeable>([
  ["CONFLICTING", "conflicting"],
  ["MERGEABLE", "mergeable"],
]);

const reviewStates = new Map<string, PullRequestReviewState>([
  ["APPROVED", "approved"],
  ["CHANGES_REQUESTED", "changesRequested"],
  ["COMMENTED", "commented"],
  ["DISMISSED", "dismissed"],
  ["PENDING", "pending"],
]);

const fileChanges = new Map<string, PullRequestFileChange>([
  ["ADDED", "added"],
  ["CHANGED", "changed"],
  ["COPIED", "copied"],
  ["DELETED", "deleted"],
  ["MODIFIED", "modified"],
  ["RENAMED", "renamed"],
]);

const viewedStates = new Map<string, PullRequestFileViewed>([
  ["DISMISSED", "dismissed"],
  ["VIEWED", "viewed"],
]);

const toReviewer = (
  reviewer: GhRequestedReviewer,
): PullRequestRequestedReviewer =>
  reviewer.__typename === "Team"
    ? { kind: "team", slug: reviewer.slug, name: reviewer.name }
    : {
        kind: "user",
        login: reviewer.login,
        avatarUrl: reviewer.avatarUrl,
      };

const nonEmpty = (text: string | null): string | null =>
  text === null || text === "" ? null : text;

/**
 * A check run still running has no conclusion, so its status decides; a
 * finished one reads like the board's rollup (`checkOutcomes`), where an
 * unknown state counts as pending rather than as a pass.
 */
const toCheck = (context: GhCheckContext): PullRequestCheck => {
  if (context.__typename === "StatusContext") {
    return {
      name: context.context,
      outcome: checkOutcomes.get(context.state) ?? "pending",
      running: false,
      description: nonEmpty(context.description),
      url: context.targetUrl,
    };
  }
  return {
    name: context.name,
    outcome:
      context.status === "COMPLETED" && context.conclusion !== null
        ? (checkOutcomes.get(context.conclusion) ?? "pending")
        : "pending",
    running: context.status === "IN_PROGRESS",
    description: nonEmpty(context.title),
    url: context.detailsUrl,
  };
};

/** Failures first, then what is still running, each run in GitHub's order. */
const checkOrder: Record<PullRequestCheck["outcome"], number> = {
  failed: 0,
  pending: 1,
  passed: 2,
};

const ghost: PullRequestPerson = { login: "ghost", avatarUrl: null };

const toAuthor = (actor: GhActor | null): PullRequestPerson =>
  actor === null ? ghost : toPerson(actor);

const reactionContents = new Map<string, PullRequestReactionContent>([
  ["CONFUSED", "confused"],
  ["EYES", "eyes"],
  ["HEART", "heart"],
  ["HOORAY", "hooray"],
  ["LAUGH", "laugh"],
  ["ROCKET", "rocket"],
  ["THUMBS_DOWN", "thumbsDown"],
  ["THUMBS_UP", "thumbsUp"],
]);

/** GitHub answers every content, nobody's included: only those reacted with are kept, in its order. */
const toReactable = (subject: GhReactable): PullRequestReactable => ({
  id: subject.id,
  viewerCanReact: subject.viewerCanReact,
  reactions: (subject.reactionGroups ?? []).flatMap((group) => {
    const content = reactionContents.get(group.content);
    if (content === undefined || group.reactors.totalCount === 0) return [];
    return [
      {
        content,
        count: group.reactors.totalCount,
        viewerHasReacted: group.viewerHasReacted,
      },
    ];
  }),
});

const toComment = (comment: GhComment): PullRequestComment => ({
  ...toReactable(comment),
  databaseId: comment.databaseId,
  author: toAuthor(comment.author),
  body: comment.body,
  createdAt: comment.createdAt,
  lastEditedAt: comment.lastEditedAt,
  url: comment.url,
  viewerCanUpdate: comment.viewerCanUpdate,
});

/**
 * A review is shown when it said something: a verdict, or a body. One that
 * only carried inline comments is an empty `COMMENTED` shell, and its comments
 * are already shown as threads. `PENDING` is the viewer's own unsent draft.
 *
 * GitHub refuses to edit a review submitted without a body ("Could not edit a
 * review with a missing body"), whatever `viewerCanUpdate` says.
 */
const toReviewItem = (review: GhReview): PullRequestTimelineItem | null => {
  if (review.state === "PENDING") return null;
  if (review.state === "COMMENTED" && review.body.trim() === "") return null;
  return {
    kind: "review",
    ...toReactable(review),
    databaseId: review.databaseId,
    author: toAuthor(review.author),
    state: reviewStates.get(review.state) ?? "commented",
    body: review.body,
    createdAt: review.submittedAt ?? review.createdAt,
    lastEditedAt: review.lastEditedAt,
    url: review.url,
    viewerCanUpdate: review.viewerCanUpdate && review.body !== "",
    commitOid: review.commit?.oid ?? null,
  };
};

const toSide = (side: string): PullRequestDiffSide =>
  side === "LEFT" ? "LEFT" : "RIGHT";

const toThreadItem = (
  thread: GhReviewThread,
): PullRequestTimelineItem | null => {
  const comments = present(thread.comments.nodes);
  const [first] = comments;
  if (first === undefined) return null;
  return {
    kind: "thread",
    id: thread.id,
    path: thread.path,
    line: thread.line,
    startLine: thread.startLine,
    side: toSide(thread.diffSide),
    startSide:
      thread.startDiffSide === null ? null : toSide(thread.startDiffSide),
    originalLine: thread.originalLine,
    originalStartLine: thread.originalStartLine,
    resolved: thread.isResolved,
    resolvedBy:
      thread.isResolved && thread.resolvedBy !== null
        ? toPerson(thread.resolvedBy)
        : null,
    outdated: thread.isOutdated,
    viewerCanResolve: thread.viewerCanResolve,
    viewerCanUnresolve: thread.viewerCanUnresolve,
    viewerCanReply: thread.viewerCanReply,
    diffHunk: first.diffHunk,
    comments: comments.map(toComment),
    commentsTotal: thread.comments.totalCount,
    createdAt: first.createdAt,
  };
};

const nameOf = (named: GhNamed): string | null => {
  if (named === null) return null;
  return "login" in named ? named.login : named.name;
};

/** The GitHub user, else the git author's name with no avatar. */
const commitAuthor = (
  commit: Pick<GhCommit, "author">,
): PullRequestPerson | null => {
  const { author } = commit;
  if (author === null) return null;
  if (author.user !== null) return toPerson(author.user);
  return author.name === null ? null : { login: author.name, avatarUrl: null };
};

const simpleActions = {
  AutoMergeDisabledEvent: "autoMergeDisabled",
  AutoMergeEnabledEvent: "autoMergeEnabled",
  ClosedEvent: "closed",
  ConvertToDraftEvent: "convertedToDraft",
  MergedEvent: "merged",
  ReadyForReviewEvent: "readyForReview",
  ReopenedEvent: "reopened",
} as const satisfies Record<string, PullRequestEventAction>;

interface EventStamp {
  actor: GhActor | null;
  createdAt: string;
}

const event = (
  action: PullRequestEventAction,
  { actor, createdAt }: EventStamp,
  extra: Partial<Pick<PullRequestEvent, "detail" | "label" | "subject">> = {},
): PullRequestEvent => ({
  kind: "event",
  action,
  actor: actor === null ? null : toPerson(actor),
  subject: null,
  label: null,
  detail: null,
  createdAt,
  ...extra,
});

type GhEventNode = Exclude<
  GhTimelineNode,
  { __typename: "IssueComment" | "PullRequestReview" }
>;

const toEvent = (node: GhEventNode): PullRequestEvent => {
  switch (node.__typename) {
    case "PullRequestCommit": {
      const { commit } = node;
      return event(
        "committed",
        { actor: commitAuthor(commit), createdAt: commit.committedDate },
        { subject: commit.messageHeadline, detail: commit.abbreviatedOid },
      );
    }
    case "AssignedEvent":
    case "UnassignedEvent": {
      return event(
        node.__typename === "AssignedEvent" ? "assigned" : "unassigned",
        node,
        { subject: nameOf(node.assignee) },
      );
    }
    case "LabeledEvent":
    case "UnlabeledEvent": {
      return event(
        node.__typename === "LabeledEvent" ? "labeled" : "unlabeled",
        node,
        {
          subject: node.label?.name ?? null,
          label: node.label === null ? null : toLabel(node.label),
        },
      );
    }
    case "ReviewRequestedEvent":
    case "ReviewRequestRemovedEvent": {
      return event(
        node.__typename === "ReviewRequestedEvent"
          ? "reviewRequested"
          : "reviewRequestRemoved",
        node,
        { subject: nameOf(node.requestedReviewer) },
      );
    }
    case "HeadRefForcePushedEvent": {
      return event("headRefForcePushed", node, {
        detail: node.afterCommit?.abbreviatedOid ?? null,
      });
    }
    case "BaseRefChangedEvent": {
      return event("baseRefChanged", node, {
        subject: node.currentRefName,
        detail: node.previousRefName,
      });
    }
    case "RenamedTitleEvent": {
      return event("renamed", node, {
        subject: node.currentTitle,
        detail: node.previousTitle,
      });
    }
    case "ReviewDismissedEvent": {
      return event("reviewDismissed", node, {
        subject: node.review?.author?.login ?? null,
      });
    }
    case "AutoMergeDisabledEvent":
    case "AutoMergeEnabledEvent":
    case "ClosedEvent":
    case "ConvertToDraftEvent":
    case "MergedEvent":
    case "ReadyForReviewEvent":
    case "ReopenedEvent": {
      return event(simpleActions[node.__typename], node);
    }
    default: {
      return node satisfies never;
    }
  }
};

const toTimelineNode = (
  node: GhTimelineNode,
): PullRequestTimelineItem | null => {
  if (node.__typename === "IssueComment") {
    return { kind: "comment", ...toComment(node) };
  }
  if (node.__typename === "PullRequestReview") return toReviewItem(node);
  return toEvent(node);
};

const isTruncated = <Node>(connection: GhConnection<Node> | null): boolean =>
  connection !== null &&
  connection.totalCount > present(connection.nodes).length;

const bodyHtmlsOf = (
  pullRequest: GhPullRequestTimeline,
): (string | undefined)[] => [
  ...present(pullRequest.timelineItems?.nodes).map((node) =>
    "bodyHTML" in node ? node.bodyHTML : undefined,
  ),
  ...present(pullRequest.reviewThreads?.nodes).flatMap((thread) =>
    present(thread.comments.nodes).map((comment) => comment.bodyHTML),
  ),
];

const toTimeline = (
  pullRequest: GhPullRequestTimeline,
): Pick<
  PullRequestTimelineResponse,
  "images" | "timeline" | "timelineTruncated"
> => {
  const items: PullRequestTimelineItem[] = [
    ...present(pullRequest.timelineItems?.nodes).map(toTimelineNode),
    ...present(pullRequest.reviewThreads?.nodes).map(toThreadItem),
  ].filter((item) => item !== null);

  return {
    timeline: items.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)),
    images: mergeImageProxies(bodyHtmlsOf(pullRequest)),
    timelineTruncated:
      pullRequest.timelineItems?.pageInfo.hasPreviousPage === true ||
      isTruncated(pullRequest.reviewThreads),
  };
};

type GhContexts = NonNullable<
  NonNullable<
    NonNullable<GhPullRequestChecks["headCommits"]["nodes"]>[number]
  >["commit"]["statusCheckRollup"]
>["contexts"];

const toChecks = (contexts: GhContexts | null): PullRequestCheck[] =>
  present(contexts?.nodes)
    .map(toCheck)
    .map((check, index) => ({ check, index }))
    .toSorted(
      (a, b) =>
        checkOrder[a.check.outcome] - checkOrder[b.check.outcome] ||
        a.index - b.index,
    )
    .map(({ check }) => check);

const toFiles = (pullRequest: GhPullRequestFiles): PullRequestFile[] =>
  present(pullRequest.files?.nodes).map((file) => ({
    path: file.path,
    additions: file.additions,
    deletions: file.deletions,
    change: fileChanges.get(file.changeType) ?? "changed",
    viewed: viewedStates.get(file.viewerViewedState) ?? "unviewed",
  }));

const toRequestedReviewers = (
  pullRequest: GhPullRequestDetail,
): PullRequestRequestedReviewer[] =>
  present(pullRequest.reviewRequests?.nodes)
    .map(({ requestedReviewer }) => requestedReviewer)
    .filter((reviewer) => reviewer !== null)
    .map(toReviewer);

const toReviewDecision = (decision: string | null): PrReviewDecision =>
  decision === null ? null : (reviewDecisions.get(decision) ?? null);

const mergeStates = new Map<string, PullRequestMergeState>([
  ["BEHIND", "behind"],
  ["BLOCKED", "blocked"],
  ["CLEAN", "clean"],
  ["DIRTY", "dirty"],
  ["DRAFT", "draft"],
  ["HAS_HOOKS", "hasHooks"],
  ["UNSTABLE", "unstable"],
]);

const mergeMethodNames = new Map<string, PullRequestMergeMethod>([
  ["MERGE", "merge"],
  ["REBASE", "rebase"],
  ["SQUASH", "squash"],
]);

const toMergeMethods = (
  repository: GhMergeSettings,
): PullRequestMergeMethod[] => {
  const allowed: PullRequestMergeMethod[] = [];
  if (repository.mergeCommitAllowed === true) allowed.push("merge");
  if (repository.squashMergeAllowed === true) allowed.push("squash");
  if (repository.rebaseMergeAllowed === true) allowed.push("rebase");
  const preferred = mergeMethodNames.get(
    repository.viewerDefaultMergeMethod ?? "",
  );
  return preferred !== undefined && allowed.includes(preferred)
    ? [preferred, ...allowed.filter((method) => method !== preferred)]
    : allowed;
};

const toCommit = ({ commit }: { commit: GhCommit }): PullRequestCommit => ({
  oid: commit.oid,
  parentOid: present(commit.parents.nodes)[0]?.oid ?? null,
  merge: commit.parents.totalCount > 1,
  headline: commit.messageHeadline,
  body: commit.messageBody.trim(),
  author: commitAuthor(commit),
  committedAt: commit.committedDate,
});

const viewerLastReview = (
  pullRequest: GhPullRequestFiles,
): PullRequestViewerLastReview | null => {
  const review = present(pullRequest.latestReviews?.nodes).find(
    ({ viewerDidAuthor }) => viewerDidAuthor,
  );
  const oid = review?.commit?.oid;
  if (review === undefined || oid === undefined) return null;
  return { oid, submittedAt: review.submittedAt };
};

const toDetail = (
  pullRequest: GhPullRequestDetail,
  repository: GhMergeSettings,
  ownerRepo: string,
): PullRequestDetail => ({
  ...toReactable(pullRequest),
  ownerRepo,
  number: pullRequest.number,
  url: pullRequest.url,
  title: pullRequest.title,
  body: pullRequest.body,
  state: toState(pullRequest.state, pullRequest.isDraft),
  author: pullRequest.author === null ? null : toPerson(pullRequest.author),
  headRef: pullRequest.headRefName,
  baseRef: pullRequest.baseRefName,
  headSha: pullRequest.headRefOid,
  baseSha: pullRequest.baseRefOid,
  createdAt: pullRequest.createdAt,
  updatedAt: pullRequest.updatedAt,
  lastEditedAt: pullRequest.lastEditedAt,
  additions: pullRequest.additions,
  deletions: pullRequest.deletions,
  changedFiles: pullRequest.changedFiles,
  mergeable: mergeables.get(pullRequest.mergeable) ?? "unknown",
  mergeState: mergeStates.get(pullRequest.mergeStateStatus) ?? "unknown",
  mergeMethods: toMergeMethods(repository),
  mergeCommitMessages: {
    merge: {
      title: pullRequest.mergeCommitHeadline,
      body: pullRequest.mergeCommitBody,
    },
    squash: {
      title: pullRequest.squashCommitHeadline,
      body: pullRequest.squashCommitBody,
    },
  },
  viewerCanUpdate: pullRequest.viewerCanUpdate,
  viewerCanUpdateBranch: pullRequest.viewerCanUpdateBranch,
  viewerCanApplySuggestion: pullRequest.viewerCanApplySuggestion,
  reviewDecision: toReviewDecision(pullRequest.reviewDecision),
  labels: present(pullRequest.labels?.nodes).map(toLabel),
  assignees: present(pullRequest.assignees?.nodes).map(toPerson),
  requestedReviewers: toRequestedReviewers(pullRequest),
  reviews: present(pullRequest.latestReviews?.nodes).map((review) => ({
    author: review.author?.login ?? "ghost",
    state: reviewStates.get(review.state) ?? "commented",
    submittedAt: review.submittedAt,
  })),
  commitsTotal: pullRequest.commits.totalCount,
});

const toChecksPart = (
  pullRequest: GhPullRequestChecks,
): Pick<PullRequestChecksResponse, "checks" | "checksTotal"> => {
  const contexts =
    pullRequest.headCommits.nodes?.[0]?.commit.statusCheckRollup?.contexts ??
    null;
  return { checks: toChecks(contexts), checksTotal: contexts?.totalCount ?? 0 };
};

/**
 * What the label, reviewer and assignee editors offer. The pull request is
 * named only for GitHub's suggested reviewers and its author, whom GitHub
 * refuses as a reviewer.
 */
export const pullRequestCandidatesQuery = `query PullRequestCandidates($owner: String!, $name: String!, $number: Int!) {
  repositoryOwner(login: $owner) {
    ... on Organization {
      teams(first: 100, orderBy: { field: NAME, direction: ASC }) {
        nodes { slug name }
      }
    }
  }
  repository(owner: $owner, name: $name) {
    labels(first: 100, orderBy: { field: NAME, direction: ASC }) {
      nodes { name color description }
    }
    assignableUsers(first: 100) { nodes { login avatarUrl } }
    pullRequest(number: $number) {
      author { login }
      suggestedReviewers { reviewer { login avatarUrl } }
    }
  }
}`;

interface GhCandidatesPullRequest {
  author: { login: string } | null;
  suggestedReviewers: ({ reviewer: GhActor | null } | null)[] | null;
}

export interface PullRequestCandidatesData {
  /** `teams` only on an organisation: a user has none */
  repositoryOwner?: {
    teams?: { nodes: ({ slug: string; name: string } | null)[] | null } | null;
  } | null;
  repository: {
    labels: { nodes: (GhLabel | null)[] | null } | null;
    assignableUsers: { nodes: (GhActor | null)[] | null } | null;
    pullRequest: GhCandidatesPullRequest | null;
  } | null;
}

/** Never the author, never anyone twice: GitHub refuses the author's review. */
const reviewerCandidates = (
  pullRequest: GhCandidatesPullRequest,
  assignable: GhActor[],
): { suggested: PullRequestPerson[]; others: PullRequestPerson[] } => {
  const author = pullRequest.author?.login;
  const seen = new Set<string>();
  const unseen = (actors: GhActor[]): PullRequestPerson[] =>
    actors.flatMap((actor) => {
      if (actor.login === author || seen.has(actor.login)) return [];
      seen.add(actor.login);
      return [toPerson(actor)];
    });
  const suggested = unseen(
    present(pullRequest.suggestedReviewers)
      .map(({ reviewer }) => reviewer)
      .filter((reviewer): reviewer is GhActor => reviewer !== null),
  );
  const others = unseen(
    assignable.toSorted((a, b) => a.login.localeCompare(b.login)),
  );
  return { suggested, others };
};

interface PartParseParams<GhPart> {
  data: PullRequestPartData<GhPart> | null;
  errors: string[];
  ownerRepo: string;
  number: number;
  fetchedAt: string;
}

const gitHubRead = ({
  fetchedAt,
  errors,
}: Pick<
  PartParseParams<unknown>,
  "errors" | "fetchedAt"
>): PullRequestRead => ({
  fetchedAt,
  checkedAt: fetchedAt,
  source: "github",
  errors,
});

/**
 * Raises when there is no pull request to show — a repository the token cannot
 * see, a number that does not exist — with GitHub's own reason; anything GitHub
 * refused beside a usable answer comes back in `errors`.
 */
const readPart = <GhPart>({
  data,
  errors,
  ownerRepo,
  number,
}: PartParseParams<GhPart>): {
  pullRequest: GhPart;
  repository: GhMergeSettings;
} => {
  const repository = data?.repository ?? null;
  const pullRequest = repository?.pullRequest ?? null;
  if (repository === null || pullRequest === null) {
    const reason = errors.length > 0 ? errors.join("; ") : "not found";
    throw new Error(
      `no pull request #${String(number)} in ${ownerRepo}: ${reason}`,
    );
  }
  return { pullRequest, repository };
};

export const parsePullRequestDetail = (
  params: PartParseParams<GhPullRequestDetail>,
): PullRequestDetailResponse => {
  const { pullRequest, repository } = readPart(params);
  return {
    pullRequest: toDetail(pullRequest, repository, params.ownerRepo),
    viewer: params.data?.viewer?.login ?? "",
    images: imageProxiesOf(pullRequest.bodyHTML),
    ...gitHubRead(params),
  };
};

export const parsePullRequestChecks = (
  params: PartParseParams<GhPullRequestChecks>,
): PullRequestChecksResponse => ({
  ...toChecksPart(readPart(params).pullRequest),
  ...gitHubRead(params),
});

export const parsePullRequestTimeline = (
  params: PartParseParams<GhPullRequestTimeline>,
): PullRequestTimelineResponse => ({
  ...toTimeline(readPart(params).pullRequest),
  ...gitHubRead(params),
});

export const parsePullRequestCommits = (
  params: PartParseParams<GhPullRequestCommits>,
): PullRequestCommitsResponse => ({
  commits: present(readPart(params).pullRequest.commits.nodes).map(toCommit),
  ...gitHubRead(params),
});

export const parsePullRequestFiles = (
  params: PartParseParams<GhPullRequestFiles>,
): PullRequestFilesResponse => {
  const { pullRequest } = readPart(params);
  return {
    files: toFiles(pullRequest),
    viewerLastReview: viewerLastReview(pullRequest),
    ...gitHubRead(params),
  };
};

const readGitHub = async <GhPart, Response>(
  transport: GitHubTransport,
  { ownerRepo, number }: PullRequestRef,
  query: string,
  parse: (params: PartParseParams<GhPart>) => Response,
): Promise<Response> => {
  const split = splitOwnerRepo(ownerRepo);
  if (split === null) throw new Error(`${ownerRepo} is not owner/repo`);
  const { data, errors } = await transport.graphql<PullRequestPartData<GhPart>>(
    query,
    {
      owner: split.owner,
      name: split.name,
      number,
    },
  );
  return parse({
    data,
    errors,
    ownerRepo,
    number,
    fetchedAt: new Date().toISOString(),
  });
};

const partReaders: {
  [Part in PullRequestPart]: (
    transport: GitHubTransport,
    ref: PullRequestRef,
  ) => Promise<PullRequestPartResponse<Part>>;
} = {
  detail: (transport, ref) =>
    readGitHub(transport, ref, pullRequestDetailQuery, parsePullRequestDetail),
  checks: (transport, ref) =>
    readGitHub(transport, ref, pullRequestChecksQuery, parsePullRequestChecks),
  timeline: (transport, ref) =>
    readGitHub(
      transport,
      ref,
      pullRequestTimelineQuery,
      parsePullRequestTimeline,
    ),
  commits: (transport, ref) =>
    readGitHub(
      transport,
      ref,
      pullRequestCommitsQuery,
      parsePullRequestCommits,
    ),
  files: (transport, ref) =>
    readGitHub(transport, ref, pullRequestFilesQuery, parsePullRequestFiles),
};

export const fetchPullRequestPart = <Part extends PullRequestPart>(
  transport: GitHubTransport,
  ref: PullRequestRef,
  part: Part,
): Promise<PullRequestPartResponse<Part>> => partReaders[part](transport, ref);

/**
 * Raises only when GitHub answered nothing usable; a missing part (teams on a
 * user's repository, a pull request the token cannot see) offers none.
 */
export const parsePullRequestCandidates = ({
  data,
  errors,
}: {
  data: PullRequestCandidatesData | null;
  errors: string[];
}): PullRequestCandidatesResponse => {
  const repository = data?.repository ?? null;
  if (repository === null) {
    throw new Error(errors.length > 0 ? errors.join("; ") : "not found");
  }
  const assignable = present(repository.assignableUsers?.nodes);
  const reviewers = reviewerCandidates(
    repository.pullRequest ?? { author: null, suggestedReviewers: null },
    assignable,
  );
  return {
    repoLabels: present(repository.labels?.nodes).map(toLabel),
    suggestedReviewers: reviewers.suggested,
    reviewerCandidates: reviewers.others,
    teamCandidates: present(data?.repositoryOwner?.teams?.nodes).map(
      ({ slug, name }) => ({ slug, name }),
    ),
    assigneeCandidates: assignable
      .toSorted((a, b) => a.login.localeCompare(b.login))
      .map(toPerson),
    errors,
  };
};

export const fetchPullRequestCandidates = async (
  transport: GitHubTransport,
  {
    ownerRepo,
    number,
  }: {
    ownerRepo: string;
    number: number;
  },
): Promise<PullRequestCandidatesResponse> => {
  const split = splitOwnerRepo(ownerRepo);
  if (split === null) throw new Error(`${ownerRepo} is not owner/repo`);
  const { data, errors } = await transport.graphql<PullRequestCandidatesData>(
    pullRequestCandidatesQuery,
    { owner: split.owner, name: split.name, number },
  );
  return parsePullRequestCandidates({ data, errors });
};
