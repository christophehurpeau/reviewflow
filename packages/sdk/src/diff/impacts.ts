export interface DiffImporter {
  path: string;
  /** `isAttachablePath`: a test, a story, a fixture */
  test: boolean;
}

export interface DiffExportImpact {
  name: string;
  /** exported at the merge base, not at head */
  removed: boolean;
  importers: DiffImporter[];
}

export interface DiffFileImpacts {
  path: string;
  /** the touched exports used outside the diff only */
  exports: DiffExportImpact[];
}

/**
 * `GET /api/prs/impacts?repo=<owner/repo>&number=<n>&head=<sha>&base=<sha>`
 * — for the range `/api/prs/diff` reads, the exports the change touches and
 * the files outside the diff that use them, across the workspace packages.
 * Read from the registered checkout at `head`; answered with a `DiffRefusal`
 * without one. `tooLarge`: nothing is analyzed, because the tree is past the
 * file budget (`reason: "files"`, which a retry does not change) or the parse
 * time budget (`reason: "time"`: what was parsed stays cached server side, so a
 * retry goes further).
 */
export type DiffImpactsResponse =
  | {
      tooLarge: false;
      files: DiffFileImpacts[];
      /** changed files not analyzed: not TypeScript, or deleted */
      notAnalyzed: string[];
      /**
       * packages holding imports that could hide a user of a changed file: a
       * path alias in a package holding a changed TypeScript file (a bare
       * specifier that is no workspace package, no node built-in and no
       * dependency of the importing package), or a workspace package specifier resolving to no file (its `exports`
       * pointing at a build output) whose target package holds one. A relative
       * or `#` specifier naming no file is never one: every changed file exists
       * at `head`.
       */
      unresolvedIn: string[];
    }
  | { tooLarge: true; reason: "files" | "time" };
