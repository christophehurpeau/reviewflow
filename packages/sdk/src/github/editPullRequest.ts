import type {
  EditPullRequestRequest,
  PullRequestDiffSide,
  PullRequestDraftComment,
  PullRequestEdit,
  PullRequestMergeCommitMessage,
  PullRequestMergeMethod,
  PullRequestReactionContent,
  PullRequestReviewEvent,
  PullRequestSuggestionRef,
} from "../api/pullRequest.ts";
import { isPullRequestReactionContent } from "../utils/pullRequestReaction.ts";
import { commitSuggestions } from "./applySuggestions.ts";
import { splitOwnerRepo } from "./prQuery.ts";
import type { GitHubTransport } from "./transport.ts";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isSha = (value: unknown): value is string =>
  typeof value === "string" && /^[\da-f]{40}$/i.test(value);

const isSide = (value: unknown): value is PullRequestDiffSide =>
  value === "LEFT" || value === "RIGHT";

const mergeMethods: PullRequestMergeMethod[] = ["merge", "rebase", "squash"];

const reviewEvents: PullRequestReviewEvent[] = [
  "approve",
  "comment",
  "requestChanges",
];

const editCommentTargets: Extract<
  PullRequestEdit,
  { kind: "editComment" }
>["target"][] = ["issueComment", "review", "reviewComment"];

const parseMergeCommitMessage = (
  value: unknown,
): PullRequestMergeCommitMessage | string => {
  if (typeof value !== "object" || value === null) {
    return "a commit message must be an object";
  }
  const message = value as Record<string, unknown>;
  if (!isNonEmptyString(message.title)) return "a commit needs a title";
  if (typeof message.body !== "string") return "a commit body must be a string";
  return { title: message.title, body: message.body };
};

/** A range needs both ends' sides; a single line needs neither. */
const parseDraftComment = (
  value: unknown,
): PullRequestDraftComment | string => {
  if (typeof value !== "object" || value === null) {
    return "a comment must be an object";
  }
  const comment = value as Record<string, unknown>;
  if (!isNonEmptyString(comment.path)) return "a comment needs a path";
  if (!isNonEmptyString(comment.body)) return "a comment cannot be empty";
  if (!isSide(comment.side)) return "a comment side must be LEFT or RIGHT";
  if (!isPositiveInteger(comment.line)) {
    return "a comment line must be a positive integer";
  }
  const startLine = comment.startLine ?? null;
  const startSide = comment.startSide ?? null;
  if (startLine === null) {
    if (startSide !== null) return "startSide needs a startLine";
  } else {
    if (!isPositiveInteger(startLine)) {
      return "startLine must be a positive integer";
    }
    if (startLine > comment.line) return "startLine cannot follow line";
    if (!isSide(startSide)) return "a range needs startSide, LEFT or RIGHT";
  }
  return {
    path: comment.path,
    side: comment.side,
    line: comment.line,
    startLine,
    startSide,
    body: comment.body,
  };
};

const parseReview = (
  edit: Record<string, unknown>,
): PullRequestEdit | string => {
  if (!reviewEvents.includes(edit.event as PullRequestReviewEvent)) {
    return "a review event must be approve, comment or requestChanges";
  }
  const event = edit.event as PullRequestReviewEvent;
  if (typeof edit.body !== "string") return "a review body must be a string";
  if (!isSha(edit.commitId)) return "a review needs the head commit sha";
  if (!Array.isArray(edit.comments)) return "a review takes a comments array";
  const comments: PullRequestDraftComment[] = [];
  for (const raw of edit.comments) {
    const parsed = parseDraftComment(raw);
    if (typeof parsed === "string") return parsed;
    comments.push(parsed);
  }
  if (event === "requestChanges" && edit.body.trim() === "") {
    return "requesting changes needs a body";
  }
  if (event === "comment" && edit.body.trim() === "" && comments.length === 0) {
    return "a comment review needs a body or a comment";
  }
  return {
    kind: "review",
    event,
    body: edit.body,
    commitId: edit.commitId,
    comments,
  };
};

const parseSuggestionRef = (
  value: unknown,
): PullRequestSuggestionRef | string => {
  if (typeof value !== "object" || value === null) {
    return "a suggestion must be an object";
  }
  const ref = value as Record<string, unknown>;
  if (!isNonEmptyString(ref.threadId)) return "a suggestion needs its threadId";
  if (!isNonEmptyString(ref.commentId)) {
    return "a suggestion needs its commentId";
  }
  return { threadId: ref.threadId, commentId: ref.commentId };
};

const parseApplySuggestions = (
  edit: Record<string, unknown>,
): PullRequestEdit | string => {
  if (!isSha(edit.expectedHeadSha)) {
    return "committing suggestions needs the head sha the screen read";
  }
  if (!Array.isArray(edit.suggestions) || edit.suggestions.length === 0) {
    return "suggestions must be a non-empty array";
  }
  const suggestions: PullRequestSuggestionRef[] = [];
  for (const raw of edit.suggestions) {
    const parsed = parseSuggestionRef(raw);
    if (typeof parsed === "string") return parsed;
    suggestions.push(parsed);
  }
  if (!isNonEmptyString(edit.headline)) return "a commit needs a headline";
  if (typeof edit.body !== "string") return "a commit body must be a string";
  return {
    kind: "applySuggestions",
    expectedHeadSha: edit.expectedHeadSha,
    suggestions,
    headline: edit.headline.trim(),
    body: edit.body,
  };
};

/** The edit off the wire, or why it is refused. */
export const parsePullRequestEdit = (
  value: unknown,
): PullRequestEdit | string => {
  if (typeof value !== "object" || value === null) return "edit is required";
  const edit = value as Record<string, unknown>;
  switch (edit.kind) {
    case "title": {
      if (typeof edit.title !== "string" || edit.title.trim() === "") {
        return "a title cannot be empty";
      }
      return { kind: "title", title: edit.title.trim() };
    }
    case "labels": {
      if (!isStringArray(edit.add) || !isStringArray(edit.remove)) {
        return "labels take add and remove, arrays of names";
      }
      return { kind: "labels", add: edit.add, remove: edit.remove };
    }
    case "reviewers": {
      if (
        !isStringArray(edit.add) ||
        !isStringArray(edit.remove) ||
        !isStringArray(edit.addTeams) ||
        !isStringArray(edit.removeTeams)
      ) {
        return "reviewers take add, remove, addTeams and removeTeams, arrays of logins and team slugs";
      }
      return {
        kind: "reviewers",
        add: edit.add,
        remove: edit.remove,
        addTeams: edit.addTeams,
        removeTeams: edit.removeTeams,
      };
    }
    case "draft": {
      if (typeof edit.draft !== "boolean") return "draft must be a boolean";
      return { kind: "draft", draft: edit.draft };
    }
    case "assignees": {
      if (!isStringArray(edit.add) || !isStringArray(edit.remove)) {
        return "assignees take add and remove, arrays of logins";
      }
      return { kind: "assignees", add: edit.add, remove: edit.remove };
    }
    case "body": {
      if (typeof edit.body !== "string") return "body must be a string";
      return { kind: "body", body: edit.body };
    }
    case "state": {
      if (edit.state !== "closed" && edit.state !== "open") {
        return "state must be closed or open";
      }
      return { kind: "state", state: edit.state };
    }
    case "merge": {
      if (!mergeMethods.includes(edit.method as PullRequestMergeMethod)) {
        return "a merge method must be merge, rebase or squash";
      }
      if (!isSha(edit.expectedHeadSha)) {
        return "a merge needs the head sha the screen read";
      }
      const merge = {
        kind: "merge",
        method: edit.method as PullRequestMergeMethod,
        expectedHeadSha: edit.expectedHeadSha,
      } as const;
      if (edit.commitMessage === undefined) return merge;
      if (merge.method === "rebase") return "a rebase writes no commit message";
      const commitMessage = parseMergeCommitMessage(edit.commitMessage);
      if (typeof commitMessage === "string") return commitMessage;
      return { ...merge, commitMessage };
    }
    case "updateBranch": {
      if (!isSha(edit.expectedHeadSha)) {
        return "updating the branch needs the head sha the screen read";
      }
      return { kind: "updateBranch", expectedHeadSha: edit.expectedHeadSha };
    }
    case "comment": {
      if (!isNonEmptyString(edit.body)) return "a comment cannot be empty";
      return { kind: "comment", body: edit.body };
    }
    case "editComment": {
      if (
        !editCommentTargets.includes(
          edit.target as (typeof editCommentTargets)[number],
        )
      ) {
        return "editComment target must be issueComment, review or reviewComment";
      }
      if (!isPositiveInteger(edit.databaseId)) {
        return "editComment needs the comment's databaseId";
      }
      if (!isNonEmptyString(edit.body)) return "a comment cannot be empty";
      return {
        kind: "editComment",
        target: edit.target as (typeof editCommentTargets)[number],
        databaseId: edit.databaseId,
        body: edit.body,
      };
    }
    case "reply": {
      if (!isPositiveInteger(edit.inReplyTo)) {
        return "a reply needs the databaseId of a comment of the thread";
      }
      if (!isNonEmptyString(edit.body)) return "a reply cannot be empty";
      return { kind: "reply", inReplyTo: edit.inReplyTo, body: edit.body };
    }
    case "reaction": {
      if (!isNonEmptyString(edit.subjectId)) {
        return "a reaction needs the id of what it reacts to";
      }
      if (!isPullRequestReactionContent(edit.content)) {
        return "unknown reaction content";
      }
      if (typeof edit.reacted !== "boolean") return "reacted must be a boolean";
      return {
        kind: "reaction",
        subjectId: edit.subjectId,
        content: edit.content,
        reacted: edit.reacted,
      };
    }
    case "resolveThread": {
      if (!isNonEmptyString(edit.threadId)) return "a thread id is required";
      if (typeof edit.resolved !== "boolean") {
        return "resolved must be a boolean";
      }
      return {
        kind: "resolveThread",
        threadId: edit.threadId,
        resolved: edit.resolved,
      };
    }
    case "viewed": {
      if (!isNonEmptyString(edit.path)) return "a file path is required";
      if (typeof edit.viewed !== "boolean") return "viewed must be a boolean";
      return { kind: "viewed", path: edit.path, viewed: edit.viewed };
    }
    case "review": {
      return parseReview(edit);
    }
    case "applySuggestions": {
      return parseApplySuggestions(edit);
    }
    case "inlineComment": {
      if (!isSha(edit.commitId)) return "a comment needs the head commit sha";
      const comment = parseDraftComment(edit.comment);
      if (typeof comment === "string") return comment;
      return { kind: "inlineComment", commitId: edit.commitId, comment };
    }
    default: {
      return "unknown edit kind";
    }
  }
};

const pullRequestIdQuery = `query PullRequestId($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) { pullRequest(number: $number) { id } }
}`;

const readyForReviewMutation = `mutation ReadyForReview($id: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $id }) { pullRequest { isDraft } }
}`;

const convertToDraftMutation = `mutation ConvertToDraft($id: ID!) {
  convertPullRequestToDraft(input: { pullRequestId: $id }) { pullRequest { isDraft } }
}`;

const resolveThreadMutation = `mutation ResolveThread($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) { thread { isResolved } }
}`;

const unresolveThreadMutation = `mutation UnresolveThread($threadId: ID!) {
  unresolveReviewThread(input: { threadId: $threadId }) { thread { isResolved } }
}`;

const addReactionMutation = `mutation AddReaction($subjectId: ID!, $content: ReactionContent!) {
  addReaction(input: { subjectId: $subjectId, content: $content }) { reaction { content } }
}`;

const removeReactionMutation = `mutation RemoveReaction($subjectId: ID!, $content: ReactionContent!) {
  removeReaction(input: { subjectId: $subjectId, content: $content }) { reaction { content } }
}`;

const reactionContentNames: Record<PullRequestReactionContent, string> = {
  confused: "CONFUSED",
  eyes: "EYES",
  heart: "HEART",
  hooray: "HOORAY",
  laugh: "LAUGH",
  rocket: "ROCKET",
  thumbsDown: "THUMBS_DOWN",
  thumbsUp: "THUMBS_UP",
};

const markViewedMutation = `mutation MarkViewed($id: ID!, $path: String!) {
  markFileAsViewed(input: { pullRequestId: $id, path: $path }) { clientMutationId }
}`;

const unmarkViewedMutation = `mutation UnmarkViewed($id: ID!, $path: String!) {
  unmarkFileAsViewed(input: { pullRequestId: $id, path: $path }) { clientMutationId }
}`;

/** Where a failure past the write is reported; nothing is logged without one. */
export interface EditLogContext extends Record<string, unknown> {
  /** the thrown value itself, for a caller that serializes its stack */
  error: unknown;
}

export interface EditLogger {
  warn: (message: string, context: EditLogContext) => void;
  error: (message: string, context: EditLogContext) => void;
}

export interface EditPullRequestOptions {
  logger?: EditLogger;
  /** called by `applyPullRequestEdit` once a viewed mark was written */
  onFileViewed?: (path: string, viewed: boolean) => void;
}

interface RepoRef {
  owner: string;
  name: string;
}

/** GraphQL names a pull request by node id, which REST callers do not have. */
const lookupPullRequestId = async (
  transport: GitHubTransport,
  { owner, name, number }: RepoRef & { number: number },
): Promise<string> => {
  const lookup = await transport.graphql<{
    repository: { pullRequest: { id: string } | null } | null;
  }>(pullRequestIdQuery, { owner, name, number });
  const id = lookup.data?.repository?.pullRequest?.id;
  if (id === undefined) {
    throw new Error(
      `no pull request #${String(number)} in ${owner}/${name}: ${lookup.errors.join("; ") || "not found"}`,
    );
  }
  return id;
};

const pullRequestHeadQuery = `query PullRequestHead($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) { pullRequest(number: $number) { headRefOid } }
}`;

/**
 * GitHub takes a verdict on any commit of the pull request, so an approval
 * sent on a head since replaced would approve code the reviewer never saw. A
 * comment review stays possible: its comments are anchored on the commit they
 * were written on.
 */
const assertVerdictOnHead = async (
  transport: GitHubTransport,
  {
    owner,
    name,
    number,
    commitId,
  }: RepoRef & { number: number; commitId: string },
): Promise<void> => {
  const lookup = await transport.graphql<{
    repository: { pullRequest: { headRefOid: string } | null } | null;
  }>(pullRequestHeadQuery, { owner, name, number });
  const head = lookup.data?.repository?.pullRequest?.headRefOid;
  if (head === undefined) {
    throw new Error(
      `no pull request #${String(number)} in ${owner}/${name}: ${lookup.errors.join("; ") || "not found"}`,
    );
  }
  if (head !== commitId) {
    throw new Error(
      `the pull request moved on to ${head.slice(0, 7)} since ${commitId.slice(0, 7)}, the commit reviewed: only a comment review can be sent on it`,
    );
  }
};

const runMutation = async (
  transport: GitHubTransport,
  query: string,
  variables: Record<string, unknown>,
  what: string,
): Promise<void> => {
  const { errors } = await transport.graphql(query, variables);
  if (errors.length > 0) {
    throw new Error(`GitHub refused ${what}: ${errors.join("; ")}`);
  }
};

/** REST has no way to change the draft state: a write through GraphQL, as threads, viewed marks and reactions are. */
const setDraft = async (
  transport: GitHubTransport,
  { owner, name, number, draft }: RepoRef & { number: number; draft: boolean },
): Promise<void> => {
  const id = await lookupPullRequestId(transport, { owner, name, number });
  await runMutation(
    transport,
    draft ? convertToDraftMutation : readyForReviewMutation,
    { id },
    "the draft change",
  );
};

const setViewed = async (
  transport: GitHubTransport,
  {
    owner,
    name,
    number,
    path,
    viewed,
  }: RepoRef & {
    number: number;
    path: string;
    viewed: boolean;
  },
): Promise<void> => {
  const id = await lookupPullRequestId(transport, { owner, name, number });
  await runMutation(
    transport,
    viewed ? markViewedMutation : unmarkViewedMutation,
    { id, path },
    "the viewed mark",
  );
};

/** GitHub's REST names the sides and lines of a comment in snake_case. */
const restComment = (comment: PullRequestDraftComment) => ({
  path: comment.path,
  body: comment.body,
  line: comment.line,
  side: comment.side,
  ...(comment.startLine === null || comment.startSide === null
    ? {}
    : {
        // eslint-disable-next-line camelcase -- GitHub's field name
        start_line: comment.startLine,
        // eslint-disable-next-line camelcase -- GitHub's field name
        start_side: comment.startSide,
      }),
});

const reviewEventNames: Record<PullRequestReviewEvent, string> = {
  approve: "APPROVE",
  comment: "COMMENT",
  requestChanges: "REQUEST_CHANGES",
};

/** Past the commit: a refusal here would describe a commit that did not happen. */
const resolveCommittedThreads = async (
  transport: GitHubTransport,
  threadIds: string[],
  logger: EditLogger | undefined,
): Promise<string | null> => {
  const failures: string[] = [];
  for (const threadId of threadIds) {
    try {
      await runMutation(
        transport,
        resolveThreadMutation,
        { threadId },
        "resolving the thread",
      );
    } catch (error) {
      logger?.warn("thread of a committed suggestion left unresolved", {
        threadId,
        error,
      });
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length === 0) return null;
  return `The suggestions were committed, but ${String(failures.length)} thread${failures.length === 1 ? "" : "s"} stayed unresolved: ${failures.join("; ")}`;
};

/**
 * Writes one change under the operator's `gh` login. Labels and reviewers are
 * an addition and a removal; when the addition passes and the removal is
 * refused, the error says so and the screen, reading the pull request again,
 * shows the half that landed. Answers what failed past the write, which
 * landed: see `EditPullRequestResponse.followUpError`.
 */
export const editPullRequest = async (
  transport: GitHubTransport,
  { ownerRepo, number, edit }: EditPullRequestRequest,
  options: EditPullRequestOptions = {},
): Promise<string | null> => {
  const split = splitOwnerRepo(ownerRepo);
  if (split === null) throw new Error(`${ownerRepo} is not owner/repo`);
  const repoPath = `repos/${encodeURIComponent(split.owner)}/${encodeURIComponent(split.name)}`;
  const pullPath = `${repoPath}/pulls/${String(number)}`;
  const issuePath = `${repoPath}/issues/${String(number)}`;

  switch (edit.kind) {
    case "title": {
      await transport.rest({
        method: "PATCH",
        path: pullPath,
        body: { title: edit.title },
      });
      return null;
    }
    case "labels": {
      if (edit.add.length > 0) {
        await transport.rest({
          method: "POST",
          path: `${issuePath}/labels`,
          body: { labels: edit.add },
        });
      }
      for (const label of edit.remove) {
        await transport.rest({
          method: "DELETE",
          path: `${issuePath}/labels/${encodeURIComponent(label)}`,
        });
      }
      return null;
    }
    case "reviewers": {
      if (edit.add.length > 0 || edit.addTeams.length > 0) {
        await transport.rest({
          method: "POST",
          path: `${pullPath}/requested_reviewers`,
          // eslint-disable-next-line camelcase -- GitHub's field name
          body: { reviewers: edit.add, team_reviewers: edit.addTeams },
        });
      }
      if (edit.remove.length > 0 || edit.removeTeams.length > 0) {
        await transport.rest({
          method: "DELETE",
          path: `${pullPath}/requested_reviewers`,
          // eslint-disable-next-line camelcase -- GitHub's field name
          body: { reviewers: edit.remove, team_reviewers: edit.removeTeams },
        });
      }
      return null;
    }
    case "draft": {
      await setDraft(transport, { ...split, number, draft: edit.draft });
      return null;
    }
    case "body": {
      await transport.rest({
        method: "PATCH",
        path: pullPath,
        body: { body: edit.body },
      });
      return null;
    }
    case "assignees": {
      if (edit.add.length > 0) {
        await transport.rest({
          method: "POST",
          path: `${issuePath}/assignees`,
          body: { assignees: edit.add },
        });
      }
      if (edit.remove.length > 0) {
        await transport.rest({
          method: "DELETE",
          path: `${issuePath}/assignees`,
          body: { assignees: edit.remove },
        });
      }
      return null;
    }
    case "state": {
      await transport.rest({
        method: "PATCH",
        path: pullPath,
        body: { state: edit.state },
      });
      return null;
    }
    case "merge": {
      await transport.rest({
        method: "PUT",
        path: `${pullPath}/merge`,
        body: {
          // eslint-disable-next-line camelcase -- GitHub's field name
          merge_method: edit.method,
          sha: edit.expectedHeadSha,
          ...(edit.commitMessage === undefined
            ? {}
            : {
                // eslint-disable-next-line camelcase -- GitHub's field name
                commit_title: edit.commitMessage.title,
                // eslint-disable-next-line camelcase -- GitHub's field name
                commit_message: edit.commitMessage.body,
              }),
        },
      });
      return null;
    }
    case "updateBranch": {
      await transport.rest({
        method: "PUT",
        path: `${pullPath}/update-branch`,
        // eslint-disable-next-line camelcase -- GitHub's field name
        body: { expected_head_sha: edit.expectedHeadSha },
      });
      return null;
    }
    case "comment": {
      await transport.rest({
        method: "POST",
        path: `${issuePath}/comments`,
        body: { body: edit.body },
      });
      return null;
    }
    case "editComment": {
      const id = String(edit.databaseId);
      if (edit.target === "review") {
        await transport.rest({
          method: "PUT",
          path: `${pullPath}/reviews/${id}`,
          body: { body: edit.body },
        });
        return null;
      }
      await transport.rest({
        method: "PATCH",
        path:
          edit.target === "issueComment"
            ? `${repoPath}/issues/comments/${id}`
            : `${repoPath}/pulls/comments/${id}`,
        body: { body: edit.body },
      });
      return null;
    }
    case "reply": {
      await transport.rest({
        method: "POST",
        path: `${pullPath}/comments/${String(edit.inReplyTo)}/replies`,
        body: { body: edit.body },
      });
      return null;
    }
    case "reaction": {
      await runMutation(
        transport,
        edit.reacted ? addReactionMutation : removeReactionMutation,
        {
          subjectId: edit.subjectId,
          content: reactionContentNames[edit.content],
        },
        "the reaction",
      );
      return null;
    }
    case "resolveThread": {
      await runMutation(
        transport,
        edit.resolved ? resolveThreadMutation : unresolveThreadMutation,
        { threadId: edit.threadId },
        "the thread change",
      );
      return null;
    }
    case "viewed": {
      await setViewed(transport, {
        ...split,
        number,
        path: edit.path,
        viewed: edit.viewed,
      });
      return null;
    }
    case "review": {
      if (edit.event !== "comment") {
        await assertVerdictOnHead(transport, {
          ...split,
          number,
          commitId: edit.commitId,
        });
      }
      await transport.rest({
        method: "POST",
        path: `${pullPath}/reviews`,
        body: {
          // eslint-disable-next-line camelcase -- GitHub's field name
          commit_id: edit.commitId,
          ...(edit.body === "" ? {} : { body: edit.body }),
          event: reviewEventNames[edit.event],
          comments: edit.comments.map(restComment),
        },
      });
      return null;
    }
    case "applySuggestions": {
      return resolveCommittedThreads(
        transport,
        await commitSuggestions(transport, { ownerRepo, number, edit }),
        options.logger,
      );
    }
    case "inlineComment": {
      await transport.rest({
        method: "POST",
        path: `${pullPath}/comments`,
        // eslint-disable-next-line camelcase -- GitHub's field name
        body: { commit_id: edit.commitId, ...restComment(edit.comment) },
      });
      return null;
    }
    default: {
      throw new Error("unknown edit");
    }
  }
};

/**
 * `editPullRequest`, then `onFileViewed` told of a viewed mark the edit is
 * known to have changed, so a caller holding a copy of the last read can bring
 * it up to date. Past GitHub's answer nothing fails the request: a callback
 * that throws is logged and ignored.
 */
export const applyPullRequestEdit = async (
  transport: GitHubTransport,
  request: EditPullRequestRequest,
  options: EditPullRequestOptions = {},
): Promise<string | null> => {
  const followUpError = await editPullRequest(transport, request, options);
  const { edit } = request;
  if (edit.kind !== "viewed") return followUpError;
  try {
    options.onFileViewed?.(edit.path, edit.viewed);
  } catch (error) {
    options.logger?.error("viewed mark not applied to the last read", {
      error,
    });
  }
  return followUpError;
};
