/**
 * A checkout's files as a host serves them to the editor: the listing, one
 * file's text and a save. Browser-safe shapes; the node side that produces
 * them is `@reviewflow/sdk/files` (`listCheckoutFiles`, `readCheckoutFile`,
 * `saveCheckoutFile`).
 */

/**
 * A file's state against `HEAD`, index and working tree together: what the
 * tree colors it by. Renames are read as a deletion and an addition.
 */
export type CheckoutFileStatus = "added" | "deleted" | "modified" | "untracked";

export interface CheckoutFilesResponse {
  /**
   * Every file of the working tree, relative to the checkout, sorted — and
   * the deleted ones, still listed so the tree shows what is gone.
   */
  paths: string[];
  /** the files that differ from `HEAD`; a path absent here is unchanged */
  statuses: Record<string, CheckoutFileStatus>;
}

/**
 * A listed path that is a symlink: git tracks the link itself, so the tree
 * lists it as a file whatever it points to.
 */
export interface CheckoutFileLink {
  /** the link's own text, as written: `../README.md` */
  target: string;
  /** the file it resolves to, relative to the checkout; null when that is not a file of the checkout */
  path: string | null;
}

/** Why a symlink has no text to open. */
export type CheckoutLinkDeadEnd =
  | "directory"
  | "gitDirectory"
  | "missing"
  | "outside";

/** Set when the path read is a symlink: the text is its target's, and a save writes there. */
interface CheckoutFileReadThroughLink {
  link?: CheckoutFileLink;
}

export type CheckoutFileRead =
  /** a file the listing had and that is gone since */
  | { status: "absent" }
  /** a NUL byte early in the file, as git judges one: not shown as text */
  | ({ status: "binary" } & CheckoutFileReadThroughLink)
  | { status: "link"; link: CheckoutFileLink; resolvesTo: CheckoutLinkDeadEnd }
  | ({ status: "text"; source: string } & CheckoutFileReadThroughLink)
  | ({
      status: "tooLarge";
      bytes: number;
      limit: number;
    } & CheckoutFileReadThroughLink);

/**
 * A file as `HEAD` has it, what the editor's draft is diffed against. Absent
 * when `HEAD` has no such file (a new or untracked one, an unborn branch): the
 * draft is then all added. A symlink at `HEAD` is its own target path, not
 * text to diff a file against.
 */
export type CheckoutFileAtHead =
  | { status: "absent" }
  | { status: "binary" }
  | { status: "link" }
  | { status: "text"; source: string }
  | { status: "tooLarge"; bytes: number; limit: number };

export interface CheckoutFileSaveRequest {
  path: string;
  source: string;
  /** what the editor opened on: the save is refused when the file holds other text now */
  expectedSource: string;
}

export type CheckoutFileSaveResponse =
  /** nothing was written; `source` is what the file holds now */
  | { status: "conflict"; source: string }
  /** nothing was written */
  | { status: "invalid"; error: string }
  | { status: "saved"; source: string; warnings: string[] };
