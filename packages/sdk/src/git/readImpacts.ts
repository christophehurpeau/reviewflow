import { builtinModules } from "node:module";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import type {
  DiffExportImpact,
  DiffFileImpacts,
  DiffImpactsResponse,
} from "../diff/impacts.ts";
import {
  expand,
  isAttachablePath,
  isTypescriptPath,
  resolveRelative,
  specificity,
  targetOf,
} from "../diff/readingOrder.ts";
import {
  dependencyNamesOf,
  manifestDirectoryOf,
  readManifests,
  resolveLocalSpecifier,
} from "./manifests.ts";
import type { Manifest } from "./manifests.ts";
import {
  exportedBindings,
  exportedNames,
  moduleBindings,
  starSpecifiers,
  touchedExports,
} from "./moduleBindings.ts";
import type { ImportedBinding, LineRange, ReExport } from "./moduleBindings.ts";
import { ensureCommits, isSha } from "./pullRequestDiff.ts";
import { readNumstat } from "./readBranchDiff.ts";
import type { NumstatEntry } from "./readBranchDiff.ts";
import { catFiles, git } from "./run.ts";

/**
 * Past this many TypeScript files at `head`, nothing is analyzed. Measured on
 * this repository (see `docs/app-review-overview-impacts.md`).
 */
export const maxTypescriptFiles = 20_000;

/**
 * Wall time after which reading and parsing the blobs not cached gives up.
 * What was parsed stays cached, so the next read gets further.
 */
export const maxReadMs = 15_000;

const batchSize = 250;
const diffChunkSize = 200;
const maxTreeBuffer = 256 * 1024 * 1024;

/** What a blob contributes to the graph, independent of the tree it is in. */
export interface ModuleSummary {
  exports: string[];
  imports: ImportedBinding[];
  reExports: ReExport[];
}

/** Parsed bindings by blob oid: the same content parses once, whatever the commit. */
export interface BindingsCache {
  get: (oid: string) => ModuleSummary | undefined;
  set: (oid: string, summary: ModuleSummary) => void;
}

export const defaultCacheEntries = 2 * maxTypescriptFiles;

/** Bounded, evicting the blob least recently read or written. */
export const createBindingsCache = (
  maxEntries: number = defaultCacheEntries,
): BindingsCache => {
  const entries = new Map<string, ModuleSummary>();
  return {
    get: (oid) => {
      const summary = entries.get(oid);
      if (summary === undefined) return undefined;
      entries.delete(oid);
      entries.set(oid, summary);
      return summary;
    },
    set: (oid, summary) => {
      entries.delete(oid);
      entries.set(oid, summary);
      for (const oldest of entries.keys()) {
        if (entries.size <= maxEntries) break;
        entries.delete(oldest);
      }
    },
  };
};

interface TreeBlob {
  path: string;
  oid: string;
}

/** The files at `sha` with their blob oids; a submodule is not one. */
const listBlobs = async (
  checkout: string,
  sha: string,
): Promise<TreeBlob[]> => {
  const listing = await git(checkout, ["ls-tree", "-r", "-z", sha], {
    maxBuffer: maxTreeBuffer,
  });
  return listing.split("\0").flatMap((record) => {
    const tab = record.indexOf("\t");
    if (tab === -1) return [];
    const [, type, oid] = record.slice(0, tab).split(" ");
    return type === "blob" && oid !== undefined
      ? [{ path: record.slice(tab + 1), oid }]
      : [];
  });
};

const isInNodeModules = (path: string): boolean =>
  path.split("/").includes("node_modules");

const emptySummary: ModuleSummary = { exports: [], imports: [], reExports: [] };

const summarize = (path: string, source: string): ModuleSummary => {
  const { bindings, reExports, imports } = moduleBindings(path, source);
  return {
    exports: exportedNames({ bindings, reExports }),
    imports,
    reExports,
  };
};

const chunksOf = <Item>(items: readonly Item[], size: number): Item[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

interface ReadSummariesParams {
  checkout: string;
  head: string;
  blobs: readonly TreeBlob[];
  cache: BindingsCache;
  budgetMs: number;
}

/**
 * The summary of every blob, by oid: from the cache, else read in batches of
 * files, parsing yielding to the event loop between two batches so a large
 * tree does not hold the server. null past `budgetMs`.
 */
const readSummaries = async ({
  checkout,
  head,
  blobs,
  cache,
  budgetMs,
}: ReadSummariesParams): Promise<Map<string, ModuleSummary> | null> => {
  const summaries = new Map<string, ModuleSummary>();
  const missing = new Map<string, string>();
  for (const { oid, path } of blobs) {
    const cached = cache.get(oid);
    if (cached === undefined) missing.set(oid, path);
    else summaries.set(oid, cached);
  }
  const deadline = Date.now() + budgetMs;
  for (const batch of chunksOf([...missing], batchSize)) {
    if (Date.now() > deadline) return null;
    const contents = await catFiles(
      checkout,
      head,
      batch.map(([, path]) => path),
    );
    for (const [oid, path] of batch) {
      const source = contents.get(path);
      const summary =
        source === undefined ? emptySummary : summarize(path, source);
      summaries.set(oid, summary);
      cache.set(oid, summary);
    }
    await yieldToEventLoop();
  }
  return summaries;
};

const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * The lines of the new side a `git diff -U0` touches, by file. A pure deletion
 * touches the line it sits before.
 */
export const parseTouchedLines = (diff: string): Map<string, LineRange[]> => {
  const touched = new Map<string, LineRange[]>();
  let current: LineRange[] | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      current = null;
    } else if (line.startsWith("+++ ")) {
      const path = line.slice(4).split("\t")[0]!;
      if (path.startsWith("b/")) {
        current = touched.get(path.slice(2)) ?? [];
        touched.set(path.slice(2), current);
      }
    } else if (line.startsWith("@@")) {
      const match = hunkHeader.exec(line);
      if (current === null || match === null) continue;
      const start = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      current.push(
        count === 0
          ? { start: start + 1, end: start + 1 }
          : { start, end: start + count - 1 },
      );
    }
  }
  return touched;
};

interface ReadTouchedLinesParams {
  checkout: string;
  mergeBase: string;
  head: string;
  entries: readonly NumstatEntry[];
}

const readTouchedLines = async ({
  checkout,
  mergeBase,
  head,
  entries,
}: ReadTouchedLinesParams): Promise<Map<string, LineRange[]>> => {
  const touched = new Map<string, LineRange[]>();
  // both sides of a rename stay in one chunk, or it is read as an added file
  for (const chunk of chunksOf(entries, diffChunkSize)) {
    const diff = await git(
      checkout,
      [
        "-c",
        "core.quotePath=false",
        "diff",
        "-U0",
        "-M",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        "--no-relative",
        "--src-prefix=a/",
        "--dst-prefix=b/",
        mergeBase,
        head,
        "--",
        ...chunk.flatMap(({ paths }) =>
          paths.map((path) => `:(literal)${path}`),
        ),
      ],
      { maxBuffer: maxTreeBuffer },
    );
    for (const [path, ranges] of parseTouchedLines(diff)) {
      touched.set(path, ranges);
    }
  }
  return touched;
};

/** `@scope/name/sub/path` as `@scope/name` and `./sub/path`. */
const splitPackageSpecifier = (
  specifier: string,
): { name: string; subpath: string } => {
  const segments = specifier.split("/");
  const nameLength = specifier.startsWith("@") ? 2 : 1;
  const rest = segments.slice(nameLength).join("/");
  return {
    name: segments.slice(0, nameLength).join("/"),
    subpath: rest === "" ? "." : `./${rest}`,
  };
};

const builtins = new Set(builtinModules);

const urlScheme = /^[a-z][a-z0-9+.-]*:/;

/** `@scope/name` as `@types/scope__name`, `name` as `@types/name`. */
const typesPackageOf = (name: string): string =>
  `@types/${name.startsWith("@") ? name.slice(1).replace("/", "__") : name}`;

/** `@/lib` and `~/lib` are aliases whatever the manifests say. */
const isConventionalAlias = (specifier: string): boolean =>
  specifier.startsWith("@/") || specifier.startsWith("~");

/** What is neither the repository's nor a path alias: a built-in, a URL-like specifier, an absolute path. */
const isBuiltinOrUrl = (specifier: string, name: string): boolean =>
  urlScheme.test(specifier) ||
  specifier.startsWith("/") ||
  builtins.has(specifier) ||
  builtins.has(name);

/**
 * What a specifier names. A relative or `#` specifier naming no file is
 * `external`: every changed file exists at `head`, so it is never one of them.
 * So is a bare specifier that is a node built-in or a dependency of the
 * importing package (or of the root's). `alias` and `workspaceMiss` are the
 * ones that could hide a user of a changed file: a bare specifier that is
 * none of those, taken for a `paths` alias resolved within the importer's
 * package; a workspace package whose entry names no file (`directory`: where
 * that package is).
 */
type Resolution =
  | { kind: "alias" }
  | { kind: "external" }
  | { kind: "file"; path: string }
  | { kind: "workspaceMiss"; directory: string };

const external: Resolution = { kind: "external" };

interface ResolverParams {
  exists: (path: string) => boolean;
  manifests: ReadonlyMap<string, Manifest>;
}

const createResolver = ({
  exists,
  manifests,
}: ResolverParams): ((from: string, specifier: string) => Resolution) => {
  const directoryOfName = new Map<string, string>();
  for (const [directory, { name }] of manifests) {
    if (typeof name === "string") directoryOfName.set(name, directory);
  }
  const dependenciesByDirectory = new Map<string, Set<string>>();
  const dependenciesOf = (directory: string): ReadonlySet<string> => {
    const known = dependenciesByDirectory.get(directory);
    if (known !== undefined) return known;
    const manifest = manifests.get(directory);
    const names = new Set(
      manifest === undefined ? [] : dependencyNamesOf(manifest),
    );
    dependenciesByDirectory.set(directory, names);
    return names;
  };
  /** declared by the nearest `package.json` of the importer, or by the root's */
  const isDependencyOf = (from: string, name: string): boolean => {
    const nearest = manifestDirectoryOf(from, manifests);
    const wanted = [name, typesPackageOf(name)];
    return [nearest, ""].some(
      (directory) =>
        directory !== null &&
        wanted.some((candidate) => dependenciesOf(directory).has(candidate)),
    );
  };

  /** a target of a manifest, relative to its directory */
  const resolveTarget = (directory: string, target: unknown): string | null =>
    typeof target === "string" && target.startsWith("./")
      ? resolveRelative(`${directory}/package.json`, target, exists)
      : null;

  const resolveInPackage = (
    directory: string,
    subpath: string,
  ): string | null => {
    const manifest = manifests.get(directory)!;
    const { exports } = manifest;
    if (exports === undefined) {
      return subpath === "."
        ? resolveTarget(directory, targetOf(manifest.types) ?? manifest.main)
        : resolveRelative(`${directory}/package.json`, subpath, exists);
    }
    const isSubpathMap =
      typeof exports === "object" &&
      exports !== null &&
      Object.keys(exports).some((key) => key.startsWith("."));
    if (!isSubpathMap) {
      return subpath === "."
        ? resolveTarget(directory, targetOf(exports))
        : null;
    }
    const patterns = Object.entries(exports as Record<string, unknown>)
      .filter(([pattern]) => pattern.startsWith("."))
      .toSorted(([left], [right]) => specificity(right) - specificity(left));
    for (const [pattern, value] of patterns) {
      const captured = expand(pattern, subpath);
      if (captured === null) continue;
      const target = targetOf(value);
      return resolveTarget(
        directory,
        typeof target === "string" ? target.replace("*", captured) : null,
      );
    }
    return null;
  };

  return (from, specifier) => {
    if (specifier.startsWith(".") || specifier.startsWith("#")) {
      const path = resolveLocalSpecifier({
        from,
        specifier,
        exists,
        manifests,
      });
      return path === null ? external : { kind: "file", path };
    }
    if (isConventionalAlias(specifier)) return { kind: "alias" };
    const { name, subpath } = splitPackageSpecifier(specifier);
    const directory = directoryOfName.get(name);
    if (directory !== undefined) {
      const path = resolveInPackage(directory, subpath);
      return path === null
        ? { kind: "workspaceMiss", directory }
        : { kind: "file", path };
    }
    if (isBuiltinOrUrl(specifier, name) || isDependencyOf(from, name)) {
      return external;
    }
    return { kind: "alias" };
  };
};

const maxStarHops = 4;

interface ReadSummariesAtParams {
  checkout: string;
  ref: string;
  roots: readonly string[];
  resolveFile: (from: string, specifier: string) => string | null;
}

/**
 * The summaries of `roots` at `ref`, and of the modules their `export *` reach,
 * within `maxStarHops`. A file missing at `ref` has none.
 */
const readSummariesAt = async ({
  checkout,
  ref,
  roots,
  resolveFile,
}: ReadSummariesAtParams): Promise<Map<string, ModuleSummary>> => {
  const found = new Map<string, ModuleSummary>();
  let toRead = [...new Set(roots)];
  for (let hop = 0; hop < maxStarHops && toRead.length > 0; hop++) {
    const contents = await catFiles(checkout, ref, toRead);
    const next = new Set<string>();
    for (const path of toRead) {
      const source = contents.get(path);
      if (source === undefined) continue;
      const summary = summarize(path, source);
      found.set(path, summary);
      for (const specifier of starSpecifiers(summary.reExports)) {
        const target = resolveFile(path, specifier);
        if (target !== null && !found.has(target)) next.add(target);
      }
    }
    toRead = [...next];
  }
  return found;
};

interface StarNamesParams {
  /** the file holding the `export *` */
  from: string;
  specifier: string;
  summaryOf: (path: string) => ModuleSummary | undefined;
  resolveFile: (from: string, specifier: string) => string | null;
}

/**
 * The names an `export * from` passes on: those of its target, and of the
 * targets of the `export *` of that one, `default` apart. null when a module
 * of the chain is unknown.
 */
const starNames = ({
  from,
  specifier,
  summaryOf,
  resolveFile,
}: StarNamesParams): string[] | null => {
  const names = new Set<string>();
  const visited = new Set<string>();
  const visit = (importer: string, request: string): boolean => {
    const target = resolveFile(importer, request);
    if (target === null) return false;
    if (visited.has(target)) return true;
    visited.add(target);
    const summary = summaryOf(target);
    if (summary === undefined) return false;
    for (const name of summary.exports) {
      if (name !== "default") names.add(name);
    }
    return starSpecifiers(summary.reExports).every((next) =>
      visit(target, next),
    );
  };
  return visit(from, specifier) ? [...names] : null;
};

interface Importer {
  from: string;
  names: readonly string[];
}

interface Passer {
  from: string;
  local: string;
  exported: string;
}

interface ReverseGraph {
  importers: ReadonlyMap<string, readonly Importer[]>;
  reExporters: ReadonlyMap<string, readonly Passer[]>;
  /** the packages holding an import that resolves to no file of the tree */
  unresolvedIn: ReadonlySet<string>;
}

interface BuildGraphParams {
  files: ReadonlyMap<string, ModuleSummary>;
  resolve: (from: string, specifier: string) => Resolution;
  /** the directory of the package holding a file, `.` for the root's */
  packageOfFile: (path: string) => string;
  /** the packages holding a changed TypeScript file */
  changedPackages: ReadonlySet<string>;
}

const buildGraph = ({
  files,
  resolve,
  packageOfFile,
  changedPackages,
}: BuildGraphParams): ReverseGraph => {
  const importers = new Map<string, Importer[]>();
  const reExporters = new Map<string, Passer[]>();
  const unresolvedIn = new Set<string>();
  const push = <Item>(
    map: Map<string, Item[]>,
    key: string,
    item: Item,
  ): void => {
    const items = map.get(key);
    if (items === undefined) map.set(key, [item]);
    else items.push(item);
  };
  for (const [path, { imports, reExports }] of files) {
    const reach = (specifier: string): string | null => {
      const resolution = resolve(path, specifier);
      const importerPackage = packageOfFile(path);
      if (
        (resolution.kind === "alias" && changedPackages.has(importerPackage)) ||
        (resolution.kind === "workspaceMiss" &&
          changedPackages.has(
            resolution.directory === "" ? "." : resolution.directory,
          ))
      ) {
        unresolvedIn.add(importerPackage);
      }
      return resolution.kind === "file" ? resolution.path : null;
    };
    for (const { specifier, names } of imports) {
      const target = reach(specifier);
      if (target !== null) push(importers, target, { from: path, names });
    }
    for (const { specifier, local, exported } of reExports) {
      const target = reach(specifier);
      if (target !== null) {
        push(reExporters, target, { from: path, local, exported });
      }
    }
  }
  return { importers, reExporters, unresolvedIn };
};

/**
 * The files using `name` of `file`, directly or through the modules passing it
 * on (a barrel, with its renames), which are followed and not listed.
 */
const importersOf = (
  { importers, reExporters }: ReverseGraph,
  file: string,
  name: string,
): Set<string> => {
  const found = new Set<string>();
  const visited = new Set([`${file}\0${name}`]);
  const stack: [string, string][] = [[file, name]];
  while (stack.length > 0) {
    const [current, currentName] = stack.pop()!;
    for (const { from, names } of importers.get(current) ?? []) {
      if (names.includes(currentName) || names.includes("*")) found.add(from);
    }
    for (const { from, local, exported } of reExporters.get(current) ?? []) {
      const passesAll = local === "*" && exported === "*";
      if (local !== "*" && local !== currentName) continue;
      if (passesAll && currentName === "default") continue;
      const next: [string, string] = [
        from,
        exported === "*" ? currentName : exported,
      ];
      const key = `${next[0]}\0${next[1]}`;
      if (visited.has(key)) continue;
      visited.add(key);
      stack.push(next);
    }
  }
  found.delete(file);
  return found;
};

export interface ImpactsRequest {
  /** the registered checkout, resolved by the caller */
  checkout: string;
  head: string;
  base: string;
  /** kept by the caller between calls: stepping through commits parses only the blobs that differ */
  cache: BindingsCache;
  /** `maxTypescriptFiles` unless set */
  maxFiles?: number;
  /** `maxReadMs` unless set */
  maxReadMs?: number;
}

/**
 * For the range `readReadingOrder` reads, the exports the change touches and
 * the files outside the diff using them, across the workspace packages. Read
 * at `head`, plus the changed files at the merge base, to know what was
 * exported before. The commits are fetched by sha when the checkout lacks them.
 *
 * Never says zero when it does not know: a specifier resolving to no file of
 * the tree (a `paths` alias, a `types` pointing at a build output) is reported
 * as unresolved by package, and what is not TypeScript is `notAnalyzed`.
 */
export const readImpacts = async ({
  checkout,
  head,
  base,
  cache,
  maxFiles = maxTypescriptFiles,
  maxReadMs: budgetMs = maxReadMs,
}: ImpactsRequest): Promise<DiffImpactsResponse> => {
  if (!isSha(head) || !isSha(base)) {
    throw new Error("head and base must be commit shas");
  }
  await ensureCommits(checkout, [head, base], undefined);
  const mergeBaseOutput = await git(checkout, ["merge-base", base, head]);
  const mergeBase = mergeBaseOutput.trim();
  const numstat = await readNumstat(checkout, [mergeBase, head], []);

  const blobs = await listBlobs(checkout, head);
  const treePaths = blobs.map(({ path }) => path);
  const inTree = new Set(treePaths);
  const typescriptBlobs = blobs.filter(
    ({ path }) => isTypescriptPath(path) && !isInNodeModules(path),
  );
  if (typescriptBlobs.length > maxFiles) {
    return { tooLarge: true, reason: "files" };
  }

  const summaries = await readSummaries({
    checkout,
    head,
    blobs: typescriptBlobs,
    cache,
    budgetMs,
  });
  if (summaries === null) return { tooLarge: true, reason: "time" };

  const manifests = await readManifests(checkout, head, treePaths);
  const files = new Map(
    typescriptBlobs.map(({ path, oid }) => [path, summaries.get(oid)!]),
  );
  const packageOfFile = (path: string): string =>
    manifestDirectoryOf(path, manifests) || ".";
  const analyzed = numstat.filter(({ path }) => files.has(path));
  const resolve = createResolver({
    exists: (path) => inTree.has(path),
    manifests,
  });
  const resolveFile = (from: string, specifier: string): string | null => {
    const resolution = resolve(from, specifier);
    return resolution.kind === "file" ? resolution.path : null;
  };
  const graph = buildGraph({
    files,
    resolve,
    packageOfFile,
    changedPackages: new Set(analyzed.map(({ path }) => packageOfFile(path))),
  });

  const changedSet = new Set(numstat.map(({ path }) => path));
  const notAnalyzed = numstat
    .filter(({ path }) => !files.has(path))
    .map(({ path }) => path);

  const touchedLines = await readTouchedLines({
    checkout,
    mergeBase,
    head,
    entries: analyzed,
  });
  const sources = await catFiles(
    checkout,
    head,
    analyzed.map(({ path }) => path),
  );
  const baseSources = await catFiles(
    checkout,
    mergeBase,
    analyzed.map(({ paths }) => paths[0]!),
  );

  const impacts: DiffFileImpacts[] = [];
  for (const { path, paths } of analyzed) {
    const source = sources.get(path);
    if (source === undefined) {
      notAnalyzed.push(path);
      continue;
    }
    const baseSource = baseSources.get(paths[0]!);
    const baseBindings =
      baseSource === undefined ? undefined : exportedBindings(path, baseSource);
    const { touched, removed, touchedStars, removedStars } = touchedExports({
      path,
      source,
      touchedLines: touchedLines.get(path) ?? [],
      baseExports:
        baseBindings === undefined ? [] : exportedNames(baseBindings),
      baseStars:
        baseBindings === undefined
          ? []
          : starSpecifiers(baseBindings.reExports),
    });
    let starsUnknown = false;
    const known = (names: string[] | null): string[] => {
      if (names === null) starsUnknown = true;
      return names ?? [];
    };
    const starNamesAtHead = (specifier: string): string[] =>
      known(
        starNames({
          from: path,
          specifier,
          summaryOf: (target) => files.get(target),
          resolveFile,
        }),
      );
    const baseSummaries =
      removedStars.length === 0
        ? new Map<string, ModuleSummary>()
        : await readSummariesAt({
            checkout,
            ref: mergeBase,
            roots: removedStars.flatMap(
              (specifier) => resolveFile(paths[0]!, specifier) ?? [],
            ),
            resolveFile,
          });
    const removedByStars = removedStars.flatMap((specifier) =>
      known(
        starNames({
          from: paths[0]!,
          specifier,
          summaryOf: (target) => baseSummaries.get(target),
          resolveFile,
        }),
      ),
    );
    const headSummary = files.get(path)!;
    const stillExported = new Set([
      ...headSummary.exports,
      ...(removed.length + removedByStars.length === 0
        ? []
        : starSpecifiers(headSummary.reExports).flatMap(starNamesAtHead)),
    ]);
    const touchedNames = new Set([
      ...touched,
      ...touchedStars.flatMap(starNamesAtHead),
    ]);
    const removedNames = new Set(
      [...removed, ...removedByStars].filter(
        (name) => !stillExported.has(name),
      ),
    );
    if (starsUnknown && !notAnalyzed.includes(path)) notAnalyzed.push(path);
    const exports: DiffExportImpact[] = [
      ...[...touchedNames].map((name) => ({ name, removed: false })),
      ...[...removedNames].map((name) => ({ name, removed: true })),
    ].flatMap(({ name, removed: isRemoved }) => {
      const importers = [...importersOf(graph, path, name)]
        .filter((importer) => !changedSet.has(importer))
        .toSorted((left, right) => left.localeCompare(right))
        .map((importer) => ({
          path: importer,
          test: isAttachablePath(importer),
        }));
      return importers.length === 0
        ? []
        : [{ name, removed: isRemoved, importers }];
    });
    if (exports.length > 0) impacts.push({ path, exports });
  }
  return {
    tooLarge: false,
    files: impacts,
    notAnalyzed,
    unresolvedIn: [...graph.unresolvedIn].toSorted((left, right) =>
      left.localeCompare(right),
    ),
  };
};
