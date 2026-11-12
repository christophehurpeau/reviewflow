import type {
  DiffFileStat,
  DiffFileStatus,
  DiffOmittedReason,
  PullRequestDiffResponse,
} from "@reviewflow/sdk";
import type { Accent } from "alouette";

export type DiffTreeFileStatus = DiffFileStatus;

/** One row of the changed-files tree. */
export interface DiffTreeFile {
  /** as the patch names it, after any rename */
  path: string;
  /**
   * null when not known: a file the patch leaves out, whose header it does
   * not carry. A file with a null status is left out.
   */
  status: DiffTreeFileStatus | null;
  /** why the patch leaves the file out; absent: it carries it, unless `status` is null */
  omitted?: DiffOmittedReason;
  /** lines added; absent or null: not counted (a binary file) */
  additions?: number | null;
  /** lines removed; absent or null: not counted */
  deletions?: number | null;
}

/** The patch leaves it out: the diff viewer has nothing to show for it. */
export const isOmittedFile = ({ status, omitted }: DiffTreeFile): boolean =>
  status === null || omitted !== undefined;

/** The tree's git colors where the diff theme has none (`PullRequestDiffTree`). */
export const statusAccents: Record<DiffTreeFileStatus, Accent> = {
  added: "success",
  modified: "info",
  renamed: "warning",
  deleted: "danger",
};

export const statusLetters: Record<DiffTreeFileStatus, string> = {
  added: "A",
  modified: "M",
  renamed: "R",
  deleted: "D",
};

const fileHeader = /^diff --git /mu;
const samePathHeader = /^a\/(.+) b\/\1$/u;
const renameTo = /^rename to (.+)$/mu;
const newFile = /^new file mode /mu;
const deletedFile = /^deleted file mode /mu;

const statusOfBlock = (block: string): DiffTreeFileStatus => {
  if (newFile.test(block)) return "added";
  if (deletedFile.test(block)) return "deleted";
  if (renameTo.test(block)) return "renamed";
  return "modified";
};

const pathOfBlock = (block: string): string | undefined => {
  const renamed = renameTo.exec(block)?.[1];
  if (renamed !== undefined) return renamed;
  const firstLine = block.slice(0, block.indexOf("\n"));
  return samePathHeader.exec(firstLine)?.[1];
};

/** Read from the patch's git headers, keyed by the path after any rename. */
export const fileStatusesOf = (
  patch: string,
): ReadonlyMap<string, DiffTreeFileStatus> =>
  new Map(
    patch
      .split(fileHeader)
      .slice(1)
      .flatMap((block) => {
        const path = pathOfBlock(block);
        return path === undefined
          ? []
          : [[path, statusOfBlock(block)] as const];
      }),
  );

/**
 * Every file of the range: the patch's, with their status, then the omitted
 * ones. A patch file whose header cannot be read counts as modified.
 */
export const diffTreeFilesOf = (
  diff: Pick<PullRequestDiffResponse, "groups" | "omitted" | "patch">,
): DiffTreeFile[] => {
  const statuses = fileStatusesOf(diff.patch);
  return [
    ...diff.groups.flatMap(({ paths }) =>
      paths.map((path) => ({
        path,
        status: statuses.get(path) ?? "modified",
      })),
    ),
    ...diff.omitted.map(({ path }) => ({ path, status: null })),
  ];
};

type ChangedFilesSource = Pick<
  PullRequestDiffResponse,
  "groups" | "omitted" | "patch"
> & {
  /** `CheckoutBranchDiffResponse.files`, absent from other diffs and older servers */
  files?: readonly DiffFileStat[];
};

/**
 * A diff's files as the changed-files tree takes them. From the git stats a
 * checkout's diff carries (`files`): status, line counts and why a file is
 * left out, binary ones included. Without them, from the patch's headers, as
 * `diffTreeFilesOf` reads them: no counts, and no status for a left out file.
 */
export const changedFilesOf = (diff: ChangedFilesSource): DiffTreeFile[] => {
  if (diff.files === undefined) return diffTreeFilesOf(diff);
  const reasons = new Map(
    diff.omitted.map(({ path, reason }) => [path, reason]),
  );
  return diff.files.map(({ path, status, additions, deletions }) => {
    const reason = reasons.get(path);
    return reason === undefined
      ? { path, status, additions, deletions }
      : { path, status, omitted: reason, additions, deletions };
  });
};
