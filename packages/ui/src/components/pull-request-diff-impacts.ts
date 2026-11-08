import type { DiffFileImpacts } from "@reviewflow/sdk";

/** `none`: no checkout, or a source that cannot read impacts. */
export type ImpactsStatus = "failed" | "none" | "reading" | "ready";

export interface ImpactCounts {
  /** touched exports used outside the diff */
  exports: number;
  /** distinct importing files, tests apart */
  files: number;
  tests: number;
  removed: boolean;
}

export const countImpacts = (
  impacts: readonly DiffFileImpacts[],
): ImpactCounts => {
  const files = new Set<string>();
  const tests = new Set<string>();
  let exports = 0;
  let removed = false;
  for (const file of impacts) {
    for (const impact of file.exports) {
      exports += 1;
      removed ||= impact.removed;
      for (const importer of impact.importers) {
        (importer.test ? tests : files).add(importer.path);
      }
    }
  }
  return { exports, files: files.size, tests: tests.size, removed };
};

/** Past this many files using a changed file's exports, each export carries its counts only. */
export const maxImporterNames = 50;

export const pluralOf = (count: number, word: string): string =>
  `${String(count)} ${word}${count === 1 ? "" : "s"}`;

/** "4 files · 2 tests", either part left out when it is 0. */
export const usageLabel = ({ files, tests }: ImpactCounts): string =>
  [
    ...(files > 0 || tests === 0 ? [pluralOf(files, "file")] : []),
    ...(tests > 0 ? [pluralOf(tests, "test")] : []),
  ].join(" · ");
