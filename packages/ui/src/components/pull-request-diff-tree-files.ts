import type { PullRequestDiffResponse } from "@reviewflow/sdk";

export type DiffTreeFileStatus = "added" | "deleted" | "modified" | "renamed";

export interface DiffTreeFile {
  path: string;
  /** null for an omitted file, whose header the patch does not carry */
  status: DiffTreeFileStatus | null;
}

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
