import type { DiffGroup, DiffReadingFile, DiffReadingGroup } from "./types.ts";

/**
 * A change read the way its code runs: within a package, from the files no
 * other changed file imports, down through what they import; packages from the
 * one depending on the others down to its dependencies. A test or a story is
 * read with the file it covers, below it.
 *
 * TypeScript only, imports within the package only (relative, or `#`
 * through its `package.json` `imports`): what a package imports from another
 * is told by the package order, not by file.
 */

const typescriptExtensions = [".ts", ".tsx", ".mts", ".cts"];

const extensionOf = (path: string): string => {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? path.slice(dot) : "";
};

export const isTypescriptPath = (path: string): boolean =>
  typescriptExtensions.includes(extensionOf(path));

const attachableSuffix = /\.(?:test|spec|stories)(?=\.[cm]?tsx?$)/;

const testDirectories = new Set([
  "__fixtures__",
  "__mocks__",
  "__tests__",
  "fixtures",
  "test",
  "tests",
]);

/**
 * A test, a story, or what only tests use (a helper, a mock, a fixture): read
 * below the file it covers rather than on its own, and never what a test is
 * read below.
 */
export const isAttachablePath = (path: string): boolean =>
  isTypescriptPath(path) &&
  (attachableSuffix.test(path) ||
    path
      .split("/")
      .slice(0, -1)
      .some((directory) => testDirectories.has(directory)));

const javascriptToTypescript: Readonly<Record<string, string>> = {
  ".js": ".ts",
  ".jsx": ".tsx",
  ".mjs": ".mts",
  ".cjs": ".cts",
};

const directoryOf = (path: string): string => {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
};

/** `a/b/../c/./d` as `a/c/d`; null when it climbs above the root. */
const normalize = (path: string): string | null => {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
};

const candidatesOf = (target: string): string[] => {
  const extension = extensionOf(target);
  const rewritten = javascriptToTypescript[extension];
  const declaration =
    rewritten === undefined
      ? `${target}.d.ts`
      : `${target.slice(0, -extension.length)}.d.ts`;
  return [
    target,
    ...(rewritten === undefined
      ? []
      : [target.slice(0, -extension.length) + rewritten]),
    ...typescriptExtensions.map((typescript) => target + typescript),
    declaration,
    `${target}/index.ts`,
    `${target}/index.tsx`,
  ];
};

const resolveTarget = (
  target: string | null,
  exists: (path: string) => boolean,
): string | null =>
  target === null
    ? null
    : (candidatesOf(target).find(
        (candidate) => isTypescriptPath(candidate) && exists(candidate),
      ) ?? null);

/**
 * The TypeScript file a relative specifier names, as TypeScript resolves it
 * under `moduleResolution: bundler`: as written, a `.js` written for its
 * `.ts`, an extension left out, or a directory's `index`. null for a bare
 * specifier, or one naming no TypeScript file at the commit.
 */
export const resolveRelative = (
  from: string,
  specifier: string,
  exists: (path: string) => boolean,
): string | null => {
  if (!specifier.startsWith(".")) return null;
  return resolveTarget(normalize(`${directoryOf(from)}/${specifier}`), exists);
};

const conditionOrder = ["types", "import", "default"];

/** The target of an `exports` or `imports` value, under `types`, `import`, then `default`. */
export const targetOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return null;
  const conditions = value as Record<string, unknown>;
  for (const condition of conditionOrder) {
    const target = targetOf(conditions[condition]);
    if (target !== null) return target;
  }
  return null;
};

/** What `*` stands for in `pattern` when it matches `specifier`; "" for an exact match. */
export const expand = (pattern: string, specifier: string): string | null => {
  const star = pattern.indexOf("*");
  if (star === -1) return pattern === specifier ? "" : null;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return null;
  return specifier.slice(prefix.length, specifier.length - suffix.length);
};

/** As node matches them: an exact key, then the pattern with the longest prefix. */
export const specificity = (pattern: string): number =>
  pattern.includes("*") ? pattern.indexOf("*") : Number.MAX_SAFE_INTEGER;

/**
 * A `#` specifier through the `imports` field of the package's own
 * `package.json` (`"#/*": "./src/*"`), then resolved as a relative one. The
 * `types`, `import` and `default` conditions are read, in that order.
 */
export const resolveSubpathImport = (
  specifier: string,
  { directory, imports }: { directory: string; imports: unknown },
  exists: (path: string) => boolean,
): string | null => {
  if (!specifier.startsWith("#")) return null;
  if (typeof imports !== "object" || imports === null) return null;
  const patterns = Object.entries(imports).toSorted(
    ([left], [right]) => specificity(right) - specificity(left),
  );
  for (const [pattern, value] of patterns) {
    const captured = expand(pattern, specifier);
    const target = targetOf(value);
    if (captured === null || target?.startsWith("./") !== true) continue;
    return resolveTarget(
      normalize(`${directory}/${target.replace("*", captured)}`),
      exists,
    );
  }
  return null;
};

const joinPath = (directory: string, name: string): string =>
  directory === "" ? name : `${directory}/${name}`;

/** Where the code a test covers sits: beside it, or above its `__tests__`. */
const coveredDirectoriesOf = (path: string): string[] => {
  const directory = directoryOf(path);
  return directory.split("/").at(-1) === "__tests__"
    ? [directory, directoryOf(directory)]
    : [directory];
};

const attachableKinds = new Set(["spec", "stories", "test"]);

/**
 * The files a test or a story may cover, most likely first: every name its
 * own name starts with, before its kind (`a.unit.test.ts` covers `a.unit.ts`,
 * else `a.ts`).
 */
export const subjectsOf = (path: string): string[] => {
  const parts = path
    .slice(directoryOf(path).length)
    .replace(/^\//, "")
    .replace(/\.[cm]?tsx?$/, "")
    .split(".");
  const kind = parts.findIndex((part) => attachableKinds.has(part));
  const stem = kind === -1 ? parts : parts.slice(0, kind);
  const names = stem.map((_, dropped) =>
    stem.slice(0, stem.length - dropped).join("."),
  );
  return coveredDirectoriesOf(path).flatMap((directory) =>
    names.flatMap((name) =>
      typescriptExtensions.map((extension) =>
        joinPath(directory, name + extension),
      ),
    ),
  );
};

export interface ReadingOrderInput {
  /** the changed files, by package, in the order the patch names them */
  groups: DiffGroup[];
  /**
   * The TypeScript files each read file imports, resolved, in source order:
   * the changed files and the unchanged ones read on the way between them. A
   * file absent from it was not read.
   */
  imports: ReadonlyMap<string, readonly string[]>;
  /** the package directories each package directory depends on */
  dependsOn: ReadonlyMap<string, ReadonlySet<string>>;
}

interface Reach {
  /** the changed files of the package being ordered */
  code: ReadonlySet<string>;
  /** every changed file, of any package */
  changed: ReadonlySet<string>;
  imports: ReadonlyMap<string, readonly string[]>;
}

/**
 * The files of `code` that `path` reaches, in import order: through the
 * unchanged files it imports, never past a changed one.
 */
const reachedFrom = (
  path: string,
  { code, changed, imports }: Reach,
): string[] => {
  const reached: string[] = [];
  const visited = new Set([path]);
  const visit = (from: string): void => {
    for (const target of imports.get(from) ?? []) {
      if (visited.has(target)) continue;
      visited.add(target);
      if (code.has(target)) reached.push(target);
      else if (!changed.has(target)) visit(target);
    }
  };
  visit(path);
  return reached;
};

const countReachable = (
  entry: string,
  edges: ReadonlyMap<string, readonly string[]>,
): number => {
  const seen = new Set([entry]);
  const stack = [entry];
  while (stack.length > 0) {
    for (const target of edges.get(stack.pop()!) ?? []) {
      if (seen.has(target)) continue;
      seen.add(target);
      stack.push(target);
    }
  }
  return seen.size - 1;
};

/**
 * Its subject by name; else, of the changed files it imports, one beside it
 * (a test imports shared helpers, a logger, before what it tests); else the
 * first.
 */
const attachTo = (
  attachable: string,
  code: ReadonlySet<string>,
  reached: readonly string[],
): string | null => {
  const covered = coveredDirectoriesOf(attachable);
  return (
    subjectsOf(attachable).find((subject) => code.has(subject)) ??
    reached.find((target) => covered.includes(directoryOf(target))) ??
    reached[0] ??
    null
  );
};

const orderGroup = (
  { name, paths }: DiffGroup,
  changed: ReadonlySet<string>,
  imports: ReadonlyMap<string, readonly string[]>,
): DiffReadingGroup => {
  const code = new Set(
    paths.filter((path) => isTypescriptPath(path) && !isAttachablePath(path)),
  );
  const attachables = paths.filter(isAttachablePath);
  const others = paths.filter((path) => !isTypescriptPath(path));
  const reach: Reach = { code, changed, imports };

  const edges = new Map(
    [...code].map((path) => [path, reachedFrom(path, reach)]),
  );
  const imported = new Set([...edges.values()].flat());

  const attached = new Map<string, string[]>();
  const standalone: string[] = [];
  for (const attachable of attachables) {
    const subject = attachTo(attachable, code, reachedFrom(attachable, reach));
    if (subject === null) standalone.push(attachable);
    else attached.set(subject, [...(attached.get(subject) ?? []), attachable]);
  }

  const reachable = new Map(
    [...code].map((path) => [path, countReachable(path, edges)]),
  );
  const byPath = (left: string, right: string): number =>
    left.localeCompare(right);
  const roots = [...code]
    .filter((path) => !imported.has(path))
    .toSorted(
      (left, right) =>
        reachable.get(right)! - reachable.get(left)! || byPath(left, right),
    );

  const ordered: string[] = [];
  const visited = new Set<string>();
  const visit = (path: string): void => {
    if (visited.has(path)) return;
    visited.add(path);
    ordered.push(path);
    for (const target of edges.get(path) ?? []) visit(target);
  };
  for (const root of roots) visit(root);
  // what only a cycle imports has no root to be reached from
  for (const path of [...code].toSorted(byPath)) visit(path);

  const entries = new Set(
    roots.filter((root) => (edges.get(root) ?? []).length > 0),
  );
  const rootPaths = new Set(roots);
  const codeFile = (path: string): DiffReadingFile => ({
    path,
    entry: entries.has(path),
    root: rootPaths.has(path),
    attached: (attached.get(path) ?? []).toSorted(byPath),
  });
  const plainFile = (path: string): DiffReadingFile => ({
    path,
    entry: false,
    root: false,
    attached: [],
  });

  return {
    name,
    files: [
      ...ordered.map(codeFile),
      ...others.map(plainFile),
      ...standalone.map(plainFile),
    ],
  };
};

const transitiveDependencies = (
  name: string,
  dependsOn: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> => {
  const found = new Set<string>();
  const stack = [name];
  while (stack.length > 0) {
    for (const dependency of dependsOn.get(stack.pop()!) ?? []) {
      if (found.has(dependency) || dependency === name) continue;
      found.add(dependency);
      stack.push(dependency);
    }
  }
  return found;
};

/**
 * A package before every package it depends on, directly or through a
 * package the change does not touch. Alphabetical between two unrelated
 * packages, and to break a cycle. The root last, as `groupDiffPaths` has it.
 */
export const orderPackages = (
  names: readonly string[],
  dependsOn: ReadonlyMap<string, ReadonlySet<string>>,
): string[] => {
  const remaining = new Set(names.filter((name) => name !== ""));
  const dependencies = new Map(
    [...remaining].map((name) => [
      name,
      transitiveDependencies(name, dependsOn),
    ]),
  );
  const isDependedOnByRemaining = (name: string): boolean =>
    [...remaining].some(
      (other) => other !== name && dependencies.get(other)!.has(name),
    );

  const ordered: string[] = [];
  while (remaining.size > 0) {
    const sorted = [...remaining].toSorted((left, right) =>
      left.localeCompare(right),
    );
    const next =
      sorted.find((name) => !isDependedOnByRemaining(name)) ?? sorted[0]!;
    ordered.push(next);
    remaining.delete(next);
  }
  if (names.includes("")) ordered.push("");
  return ordered;
};

export const orderForReading = ({
  groups,
  imports,
  dependsOn,
}: ReadingOrderInput): DiffReadingGroup[] => {
  const byName = new Map(groups.map((group) => [group.name, group]));
  const changed = new Set(groups.flatMap(({ paths }) => paths));
  return orderPackages(
    groups.map(({ name }) => name),
    dependsOn,
  ).map((name) => orderGroup(byName.get(name)!, changed, imports));
};
