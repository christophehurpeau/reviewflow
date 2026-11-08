import { parseSync } from "oxc-parser";
import { isTypescriptPath, orderForReading } from "../diff/readingOrder.ts";
import type { DiffReadingOrderResponse } from "../diff/types.ts";
import {
  groupDiffPaths,
  listTree,
  packageOf,
  packagesInListing,
} from "./groupDiffPaths.ts";
import type { IsPackage } from "./groupDiffPaths.ts";
import {
  dependencyNamesOf,
  readManifests,
  resolveLocalSpecifier,
} from "./manifests.ts";
import type { Manifest } from "./manifests.ts";
import { ensureCommits, isSha } from "./pullRequestDiff.ts";
import { readNumstat } from "./readBranchDiff.ts";
import { catFiles, git } from "./run.ts";

/**
 * How many unchanged files an import is followed through to reach a changed
 * one: a barrel `index.ts` is one, a barrel re-exporting a barrel two.
 */
const maxUnchangedHops = 2;

const stringLiteral = /^(["'`])(.*)\1$/s;

/**
 * The modules a TypeScript file imports or re-exports, as written, in source
 * order: `import type` included, a dynamic `import()` only when its argument
 * is a plain string. A syntax error yields whatever was parsed before it.
 */
export const importSpecifiers = (path: string, source: string): string[] => {
  const { staticImports, staticExports, dynamicImports } = parseSync(
    path,
    source,
  ).module;
  const found: { start: number; specifier: string }[] = [
    ...staticImports.map(({ start, moduleRequest }) => ({
      start,
      specifier: moduleRequest.value,
    })),
    ...staticExports.flatMap(({ start, entries }) =>
      entries.flatMap(({ moduleRequest }) =>
        moduleRequest === null
          ? []
          : [{ start, specifier: moduleRequest.value }],
      ),
    ),
    ...dynamicImports.flatMap(({ start, moduleRequest }) => {
      const literal = stringLiteral.exec(
        source.slice(moduleRequest.start, moduleRequest.end),
      );
      const specifier = literal?.[2];
      return specifier === undefined || specifier.includes("${")
        ? []
        : [{ start, specifier }];
    }),
  ];
  return [
    ...new Set(
      found
        .toSorted((left, right) => left.start - right.start)
        .map(({ specifier }) => specifier),
    ),
  ];
};

interface ReadImportsParams {
  checkout: string;
  head: string;
  changed: readonly string[];
  exists: (path: string) => boolean;
  isPackage: IsPackage;
  manifests: ReadonlyMap<string, Manifest>;
}

/**
 * The resolved imports within the package of the changed TypeScript files,
 * and of the unchanged files of the same package they reach within
 * `maxUnchangedHops`.
 */
const readImports = async ({
  checkout,
  head,
  changed,
  exists,
  isPackage,
  manifests,
}: ReadImportsParams): Promise<Map<string, string[]>> => {
  const changedSet = new Set(changed);
  const imports = new Map<string, string[]>();
  let toRead = changed.filter((path) => isTypescriptPath(path) && exists(path));
  for (let hop = 0; hop <= maxUnchangedHops && toRead.length > 0; hop++) {
    const contents = await catFiles(checkout, head, toRead);
    const next = new Set<string>();
    for (const path of toRead) {
      const source = contents.get(path);
      const resolved = (
        source === undefined ? [] : importSpecifiers(path, source)
      )
        .map((specifier) =>
          resolveLocalSpecifier({ from: path, specifier, exists, manifests }),
        )
        .filter((target) => target !== null);
      imports.set(path, resolved);
      const ownPackage = packageOf(path, isPackage);
      for (const target of resolved) {
        if (changedSet.has(target) || imports.has(target)) continue;
        if (packageOf(target, isPackage) === ownPackage) next.add(target);
      }
    }
    toRead = [...next];
  }
  return imports;
};

/**
 * Which package directory depends on which: a dependency of any kind naming
 * another package of the repository.
 */
const packageDependencies = (
  manifests: ReadonlyMap<string, Manifest>,
): Map<string, Set<string>> => {
  const directoryOfName = new Map<string, string>();
  for (const [directory, { name }] of manifests) {
    if (typeof name === "string") directoryOfName.set(name, directory);
  }
  return new Map(
    [...manifests].map(([directory, manifest]) => [
      directory,
      new Set(
        dependencyNamesOf(manifest).flatMap((name) => {
          const dependency = directoryOfName.get(name);
          return dependency === undefined || dependency === directory
            ? []
            : [dependency];
        }),
      ),
    ]),
  );
};

export interface ReadingOrderRequest {
  /** the registered checkout, resolved by the caller */
  checkout: string;
  head: string;
  base: string;
}

/**
 * The files of the range `/api/prs/diff` reads (head against its merge base
 * with base), with whitespace shown, ordered for reading. The commits are
 * fetched by sha when the checkout lacks them, as the diff does.
 */
export const readReadingOrder = async ({
  checkout,
  head,
  base,
}: ReadingOrderRequest): Promise<DiffReadingOrderResponse> => {
  if (!isSha(head) || !isSha(base)) {
    throw new Error("head and base must be commit shas");
  }
  await ensureCommits(checkout, [head, base], undefined);
  const mergeBaseOutput = await git(checkout, ["merge-base", base, head]);
  const mergeBase = mergeBaseOutput.trim();
  const numstat = await readNumstat(checkout, [mergeBase, head], []);
  const changed = numstat.map(({ path }) => path);
  const tree = await listTree(checkout, head);
  const inTree = new Set(tree);
  const exists = (path: string): boolean => inTree.has(path);
  const isPackage = packagesInListing(tree);
  const manifests = await readManifests(checkout, head, tree);
  const imports = await readImports({
    checkout,
    head,
    changed,
    exists,
    isPackage,
    manifests,
  });
  return {
    groups: orderForReading({
      groups: groupDiffPaths(isPackage, changed),
      imports,
      dependsOn: packageDependencies(manifests),
    }),
  };
};
