import type {
  PullRequestDiffSide,
  PullRequestEdit,
} from "../api/pullRequest.ts";
import type { PrState } from "../types/entities.ts";
import {
  parseSuggestions,
  suggestionCommitRefusal,
  suggestionRangesOverlap,
} from "../utils/pullRequestSuggestion.ts";
import { splitOwnerRepo } from "./prQuery.ts";
import type { GitHubTransport } from "./transport.ts";

/**
 * GitHub has no mutation applying a suggestion: its "Commit suggestion" is a
 * web commit. `createCommitOnBranch` is the API's web commit — authored by the
 * token's owner, signed by GitHub — and takes whole files, so each file is
 * read at the expected head and rewritten here. Every check runs on GitHub's
 * current state of the threads before the commit, since the screen's may be
 * one read old.
 */

export type ApplySuggestionsEdit = Extract<
  PullRequestEdit,
  { kind: "applySuggestions" }
>;

const suggestionsQuery = `query SuggestionsToApply($owner: String!, $name: String!, $number: Int!, $threadIds: [ID!]!, $commentIds: [ID!]!) {
  viewer { login }
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id state headRefOid headRefName viewerCanApplySuggestion
      headRepository { nameWithOwner }
    }
  }
  threads: nodes(ids: $threadIds) {
    ... on PullRequestReviewThread {
      id path line startLine diffSide startDiffSide isOutdated isResolved
      pullRequest { id }
      comments(first: 1) { nodes { id } }
    }
  }
  comments: nodes(ids: $commentIds) {
    ... on PullRequestReviewComment {
      id body state
      replyTo { id }
      author { login ... on User { databaseId name } }
    }
  }
}`;

interface GhSuggestionThread {
  id?: string;
  path: string;
  line: number | null;
  startLine: number | null;
  diffSide: string;
  startDiffSide: string | null;
  isOutdated: boolean;
  isResolved: boolean;
  pullRequest: { id: string };
  comments: { nodes: ({ id: string } | null)[] | null };
}

interface GhSuggester {
  login: string;
  databaseId?: number;
  name?: string | null;
}

interface GhSuggestionComment {
  id?: string;
  body: string;
  state: string;
  replyTo: { id: string } | null;
  author: GhSuggester | null;
}

interface SuggestionsAnswer {
  viewer: { login: string };
  repository: {
    pullRequest: {
      id: string;
      state: string;
      headRefOid: string;
      headRefName: string;
      viewerCanApplySuggestion: boolean;
      headRepository: { nameWithOwner: string } | null;
    } | null;
  } | null;
  threads: (GhSuggestionThread | null)[];
  comments: (GhSuggestionComment | null)[];
}

export interface PlannedSuggestion {
  threadId: string;
  resolved: boolean;
  path: string;
  startLine: number | null;
  line: number;
  lines: string[];
  author: GhSuggester | null;
}

export interface SuggestionsPlan {
  repositoryNameWithOwner: string;
  branchName: string;
  viewerLogin: string;
  suggestions: PlannedSuggestion[];
}

const toPrState = (state: string): PrState => {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return "open";
};

const toSide = (side: string | null): PullRequestDiffSide | null => {
  if (side === null) return null;
  return side === "LEFT" ? "LEFT" : "RIGHT";
};

/** Each suggestion as GitHub holds it, or why the batch is refused. */
export const planSuggestions = (
  answer: SuggestionsAnswer,
  edit: ApplySuggestionsEdit,
): SuggestionsPlan => {
  const pullRequest = answer.repository?.pullRequest;
  if (pullRequest === null || pullRequest === undefined) {
    throw new Error("the pull request is not found");
  }
  if (pullRequest.headRefOid !== edit.expectedHeadSha) {
    throw new Error(
      `the pull request moved on to ${pullRequest.headRefOid.slice(0, 7)} since ${edit.expectedHeadSha.slice(0, 7)}: read it again before committing`,
    );
  }
  if (pullRequest.headRepository === null) {
    throw new Error("the head branch's repository no longer exists");
  }

  const suggestions: PlannedSuggestion[] = [];
  edit.suggestions.forEach((ref, index) => {
    const thread = answer.threads[index];
    const comment = answer.comments[index];
    if (thread?.id !== ref.threadId) {
      throw new Error(`no review thread ${ref.threadId}`);
    }
    if (thread.pullRequest.id !== pullRequest.id) {
      throw new Error(`thread ${ref.threadId} is not of this pull request`);
    }
    if (comment?.id !== ref.commentId) {
      throw new Error(`no review comment ${ref.commentId}`);
    }
    const root = comment.replyTo?.id ?? comment.id;
    if (root !== thread.comments.nodes?.[0]?.id) {
      throw new Error(`comment ${ref.commentId} is not in that thread`);
    }
    if (comment.state === "PENDING") {
      throw new Error("a suggestion in a pending review cannot be committed");
    }
    const parsed = parseSuggestions(comment.body);
    const refusal = suggestionCommitRefusal({
      state: toPrState(pullRequest.state),
      viewerCanApplySuggestion: pullRequest.viewerCanApplySuggestion,
      suggestionCount: parsed.length,
      outdated: thread.isOutdated,
      line: thread.line,
      side: toSide(thread.diffSide) ?? "RIGHT",
      startSide: toSide(thread.startDiffSide),
    });
    const [lines] = parsed;
    if (refusal !== null || thread.line === null || lines === undefined) {
      throw new Error(`${thread.path}: ${refusal ?? "nothing to commit"}`);
    }
    const planned: PlannedSuggestion = {
      threadId: thread.id,
      resolved: thread.isResolved,
      path: thread.path,
      startLine: thread.startLine,
      line: thread.line,
      lines,
      author: comment.author,
    };
    if (suggestions.some((other) => suggestionRangesOverlap(other, planned))) {
      throw new Error(
        `${planned.path}: two suggestions of the batch replace line ${String(planned.line)}`,
      );
    }
    suggestions.push(planned);
  });

  return {
    repositoryNameWithOwner: pullRequest.headRepository.nameWithOwner,
    branchName: pullRequest.headRefName,
    viewerLogin: answer.viewer.login,
    suggestions,
  };
};

type SuggestionLines = Pick<PlannedSuggestion, "line" | "lines" | "startLine">;

/**
 * The file with each range replaced, bottom first so the line numbers above
 * still hold. A file in CRLF keeps it on the lines put in.
 */
export const applySuggestionsToText = (
  text: string,
  suggestions: SuggestionLines[],
): string => {
  const eol = text.includes("\r\n") ? "\r" : "";
  const lines = text.split("\n");
  const endsWithNewline = lines.at(-1) === "";
  const lineCount = endsWithNewline ? lines.length - 1 : lines.length;
  const bottomFirst = suggestions.toSorted((a, b) => b.line - a.line);
  for (const { startLine, line, lines: replacement } of bottomFirst) {
    if (line > lineCount) {
      throw new Error(
        `line ${String(line)} is past the end of the file, ${String(lineCount)} lines long`,
      );
    }
    const first = startLine ?? line;
    const isLastLine = line === lineCount && !endsWithNewline;
    const put = replacement.map((content, index) =>
      isLastLine && index === replacement.length - 1 ? content : content + eol,
    );
    lines.splice(first - 1, line - first + 1, ...put);
  }
  return lines.join("\n");
};

/** GitHub's own trailer for a suggestion it commits, with the account's noreply address. */
export const coAuthorTrailers = (
  authors: (GhSuggester | null)[],
  viewerLogin: string,
): string[] => {
  const seen = new Set<string>([viewerLogin]);
  const trailers: string[] = [];
  for (const author of authors) {
    if (author?.databaseId === undefined || seen.has(author.login)) continue;
    seen.add(author.login);
    const name =
      author.name === null || author.name === undefined || author.name === ""
        ? author.login
        : author.name;
    trailers.push(
      `Co-authored-by: ${name} <${String(author.databaseId)}+${author.login}@users.noreply.github.com>`,
    );
  }
  return trailers;
};

const fileQuery = (count: number): string => {
  const indexes = Array.from({ length: count }, (_, index) => index);
  const variables = indexes
    .map((index) => `$e${String(index)}: String!`)
    .join(", ");
  const fields = indexes
    .map(
      (index) =>
        `f${String(index)}: object(expression: $e${String(index)}) { ... on Blob { text isBinary isTruncated } }`,
    )
    .join("\n    ");
  return `query SuggestedFiles($owner: String!, $name: String!, ${variables}) {
  repository(owner: $owner, name: $name) {
    ${fields}
  }
}`;
};

interface GhBlob {
  text: string | null;
  isBinary: boolean | null;
  isTruncated: boolean;
}

const readFiles = async (
  transport: GitHubTransport,
  nameWithOwner: string,
  sha: string,
  paths: string[],
): Promise<Map<string, string>> => {
  const split = splitOwnerRepo(nameWithOwner);
  if (split === null) throw new Error(`${nameWithOwner} is not owner/repo`);
  const variables = Object.fromEntries(
    paths.map((path, index) => [`e${String(index)}`, `${sha}:${path}`]),
  );
  const { data, errors } = await transport.graphql<{
    repository: Record<string, GhBlob | null> | null;
  }>(fileQuery(paths.length), { ...split, ...variables });
  if (errors.length > 0) {
    throw new Error(`GitHub refused reading the files: ${errors.join("; ")}`);
  }
  const files = new Map<string, string>();
  paths.forEach((path, index) => {
    const blob = data?.repository?.[`f${String(index)}`];
    const text = blob?.text;
    if (
      text === null ||
      text === undefined ||
      blob?.isBinary === true ||
      blob?.isTruncated === true
    ) {
      throw new Error(`${path} cannot be read as text at ${sha.slice(0, 7)}`);
    }
    files.set(path, text);
  });
  return files;
};

const createCommitMutation = `mutation CommitSuggestions($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid } }
}`;

/** `Buffer` does not exist in the browser: UTF-8 bytes, then base64. */
const toBase64 = (text: string): string => {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
};

const messageBody = (body: string, trailers: string[]): string =>
  [body.trim(), trailers.join("\n")].filter((part) => part !== "").join("\n\n");

/**
 * Commits the suggestions, as one commit on the head branch. Answers the
 * threads left to resolve, as GitHub does once it commits a suggestion.
 */
export const commitSuggestions = async (
  transport: GitHubTransport,
  {
    ownerRepo,
    number,
    edit,
  }: {
    ownerRepo: string;
    number: number;
    edit: ApplySuggestionsEdit;
  },
): Promise<string[]> => {
  const split = splitOwnerRepo(ownerRepo);
  if (split === null) throw new Error(`${ownerRepo} is not owner/repo`);
  const lookup = await transport.graphql<SuggestionsAnswer>(suggestionsQuery, {
    ...split,
    number,
    threadIds: edit.suggestions.map(({ threadId }) => threadId),
    commentIds: edit.suggestions.map(({ commentId }) => commentId),
  });
  if (lookup.data === null) {
    throw new Error(
      `GitHub refused reading the suggestions: ${lookup.errors.join("; ") || "no answer"}`,
    );
  }
  const plan = planSuggestions(lookup.data, edit);

  const paths = [...new Set(plan.suggestions.map(({ path }) => path))];
  const files = await readFiles(
    transport,
    plan.repositoryNameWithOwner,
    edit.expectedHeadSha,
    paths,
  );
  const additions = paths.map((path) => {
    const text = applySuggestionsToText(
      files.get(path) ?? "",
      plan.suggestions.filter((suggestion) => suggestion.path === path),
    );
    return { path, contents: toBase64(text) };
  });

  const { errors } = await transport.graphql(createCommitMutation, {
    input: {
      branch: {
        repositoryNameWithOwner: plan.repositoryNameWithOwner,
        branchName: plan.branchName,
      },
      expectedHeadOid: edit.expectedHeadSha,
      message: {
        headline: edit.headline,
        body: messageBody(
          edit.body,
          coAuthorTrailers(
            plan.suggestions.map(({ author }) => author),
            plan.viewerLogin,
          ),
        ),
      },
      fileChanges: { additions },
    },
  });
  if (errors.length > 0) {
    throw new Error(`GitHub refused the commit: ${errors.join("; ")}`);
  }

  return plan.suggestions
    .filter(({ resolved }) => !resolved)
    .map(({ threadId }) => threadId);
};
