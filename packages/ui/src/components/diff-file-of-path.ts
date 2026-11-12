import type { FileDiffMetadata } from "@pierre/diffs";

/**
 * The file of a parsed patch that `path` names, matched on its name after any
 * rename, as a diff's `groups` and the changed-files tree name it: the old side
 * of a rename names nothing.
 */
export const fileOfPath = (
  files: readonly FileDiffMetadata[],
  path: string,
): FileDiffMetadata | undefined => files.find(({ name }) => name === path);
