import { existsSync } from "node:fs";
import { join } from "node:path";
import type { DiffGroup } from "../diff/types.ts";
import { git } from "./run.ts";

/**
 * A monorepo's changes read by package: `apps/resident` and `.claude` rather
 * than one flat list. The package is the nearest directory holding a manifest
 * of any ecosystem — what every workspace tool agrees on — rather than one
 * matched against each tool's workspace globs, which would mean parsing as
 * many formats to answer the same question. The root's own manifest does not
 * count, or every file would be in one group.
 *
 * Fixed names only: a manifest named after its package (`*.gemspec`,
 * `*.csproj`) would need a directory listing per level instead of a stat.
 *
 * The caller says where the manifests are, as an `isPackage(directory)`
 * predicate: `packagesAtTree` reads them from a commit's tree (a pull request's
 * head, whatever the checkout has out), `packagesOnDisk` from a working tree.
 * A file deleted along with its whole package falls back to its first
 * directory: there is no manifest left to find.
 */

const manifestNames = [
  // javascript
  "package.json",
  // python
  "pyproject.toml",
  "setup.py",
  // ruby
  "Gemfile",
  // rust
  "Cargo.toml",
  // go
  "go.mod",
  // php
  "composer.json",
  // jvm
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  // elixir
  "mix.exs",
  // dart
  "pubspec.yaml",
  // swift
  "Package.swift",
];

const manifests = new Set(manifestNames);

export const isManifestPath = (path: string): boolean =>
  manifests.has(path.slice(path.lastIndexOf("/") + 1));

export const packageOf = (
  path: string,
  isPackage: (directory: string) => boolean,
): string => {
  const directories = path.split("/").slice(0, -1);
  for (let depth = directories.length; depth >= 1; depth--) {
    const directory = directories.slice(0, depth).join("/");
    if (isPackage(directory)) return directory;
  }
  return directories[0] ?? "";
};

export type IsPackage = (directory: string) => boolean;

/** No manifest known: every file goes under its first directory. */
export const noPackages: IsPackage = () => false;

/** Every file at `sha`. The commit must be in the checkout. */
export const listTree = async (
  checkout: string,
  sha: string,
): Promise<string[]> => {
  const listing = await git(
    checkout,
    ["ls-tree", "-r", "--name-only", "-z", sha],
    {
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  return listing.split("\0").filter((path) => path !== "");
};

/** The directories holding a manifest among `paths`. The root does not count. */
export const packagesInListing = (paths: readonly string[]): IsPackage => {
  const directories = new Set<string>();
  for (const path of paths) {
    const slash = path.lastIndexOf("/");
    if (slash === -1) continue;
    if (isManifestPath(path)) directories.add(path.slice(0, slash));
  }
  return (directory) => directories.has(directory);
};

/** The directories holding a manifest at `sha`, from one `git ls-tree`. */
export const packagesAtTree = async (
  checkout: string,
  sha: string,
): Promise<IsPackage> => packagesInListing(await listTree(checkout, sha));

/** For a caller whose files are in a working tree, uncommitted ones included. */
export const packagesOnDisk = (worktree: string): IsPackage => {
  const known = new Map<string, boolean>();
  return (directory) => {
    const cached = known.get(directory);
    if (cached !== undefined) return cached;
    const found = manifestNames.some((manifest) =>
      existsSync(join(worktree, directory, manifest)),
    );
    known.set(directory, found);
    return found;
  };
};

export const groupDiffPaths = (
  isPackage: IsPackage,
  paths: string[],
): DiffGroup[] => {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const name = packageOf(path, isPackage);
    const group = groups.get(name);
    if (group === undefined) groups.set(name, [path]);
    else group.push(path);
  }
  // The root last: its files (a lockfile, the root manifest, a README) follow
  // from the packages' changes rather than explain them.
  return [...groups]
    .toSorted(([left], [right]) => Number(left === "") - Number(right === ""))
    .map(([name, groupPaths]) => ({ name, paths: groupPaths }));
};
