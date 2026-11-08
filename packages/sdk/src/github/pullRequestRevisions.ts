import type {
  PullRequestRevision,
  PullRequestRevisionsResponse,
} from "../api/pullRequest.ts";
import { diffLines } from "./lineDiff.ts";
import type { GitHubTransport } from "./transport.ts";

/** GitHub's own page lists a whole history; past this, the screen links to it. */
const revisionsPage = 50;

/**
 * `userContentEdits` lists the newest first and ends on the original, when
 * GitHub kept it (`includesCreatedEdit`). Despite its name, an edit's `diff` is
 * the whole text of that version, not a change.
 */
export const pullRequestRevisionsQuery = `query PullRequestRevisions($id: ID!) {
  node(id: $id) {
    ... on Comment {
      includesCreatedEdit
      userContentEdits(first: ${String(revisionsPage)}) {
        totalCount
        nodes {
          editedAt
          deletedAt
          editor { login avatarUrl }
          deletedBy { login }
          diff
        }
      }
    }
  }
}`;

interface GhActor {
  login: string;
  avatarUrl?: string | null;
}

interface GhContentEdit {
  editedAt: string;
  deletedAt: string | null;
  editor: GhActor | null;
  deletedBy: { login: string } | null;
  diff: string | null;
}

export interface PullRequestRevisionsData {
  node: {
    includesCreatedEdit?: boolean;
    userContentEdits?: {
      totalCount: number;
      nodes: (GhContentEdit | null)[] | null;
    } | null;
  } | null;
}

/** A body typed on GitHub's page carries `\r\n`, one sent through the API `\n`. */
const normalizeNewlines = (text: string | null): string | null =>
  text?.replaceAll("\r\n", "\n") ?? null;

export const parsePullRequestRevisions = ({
  data,
  errors,
  subjectId,
}: {
  data: PullRequestRevisionsData | null;
  errors: string[];
  subjectId: string;
}): PullRequestRevisionsResponse => {
  const edits = data?.node?.userContentEdits ?? null;
  if (edits === null) {
    const reason = errors.length > 0 ? errors.join("; ") : "not found";
    throw new Error(`no edit history for ${subjectId}: ${reason}`);
  }
  // GitHub's index, before its unresolved (null) entries are dropped: the
  // original is the last of `totalCount`, whatever the page lost
  const nodes = (edits.nodes ?? []).flatMap((node, rawIndex) =>
    node === null ? [] : [{ ...node, rawIndex }],
  );
  const bodies = nodes.map((node) =>
    node.deletedAt === null ? normalizeNewlines(node.diff) : null,
  );
  const lastIndex = edits.totalCount - 1;

  const revisions = nodes.map((node, index): PullRequestRevision => {
    const body = bodies[index] ?? null;
    const before = bodies.slice(index + 1).find((older) => older !== null);
    return {
      editedAt: node.editedAt,
      editor:
        node.editor === null
          ? null
          : {
              login: node.editor.login,
              avatarUrl: node.editor.avatarUrl ?? null,
            },
      original:
        data?.node?.includesCreatedEdit === true && node.rawIndex === lastIndex,
      body,
      deletedBy: node.deletedBy?.login ?? null,
      changes:
        body === null || before === undefined
          ? null
          : diffLines({ before, after: body }),
    };
  });

  return { revisions, revisionsTotal: edits.totalCount };
};

/**
 * Raises with GitHub's reason when the id names nothing the token can read, or
 * something that is not a comment.
 */
export const fetchPullRequestRevisions = async (
  transport: GitHubTransport,
  subjectId: string,
): Promise<PullRequestRevisionsResponse> => {
  const { data, errors } = await transport.graphql<PullRequestRevisionsData>(
    pullRequestRevisionsQuery,
    { id: subjectId },
  );
  return parsePullRequestRevisions({ data, errors, subjectId });
};
