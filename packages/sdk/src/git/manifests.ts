import { resolveRelative, resolveSubpathImport } from "../diff/readingOrder.ts";
import { catFiles } from "./run.ts";

export type Manifest = Record<string, unknown>;

/** The `package.json` holding `path`, the root's included: whose `imports` apply. */
export const manifestDirectoryOf = (
  path: string,
  manifests: ReadonlyMap<string, Manifest>,
): string | null => {
  const directories = path.split("/").slice(0, -1);
  for (let depth = directories.length; depth >= 0; depth--) {
    const directory = directories.slice(0, depth).join("/");
    if (manifests.has(directory)) return directory;
  }
  return null;
};

export interface ResolveLocalParams {
  /** the file holding the specifier */
  from: string;
  specifier: string;
  exists: (path: string) => boolean;
  manifests: ReadonlyMap<string, Manifest>;
}

/**
 * The file a relative or `#` (`imports` of the nearest `package.json`)
 * specifier names, null when it names none or is neither.
 */
export const resolveLocalSpecifier = ({
  from,
  specifier,
  exists,
  manifests,
}: ResolveLocalParams): string | null => {
  if (!specifier.startsWith("#")) {
    return resolveRelative(from, specifier, exists);
  }
  const directory = manifestDirectoryOf(from, manifests);
  if (directory === null) return null;
  return resolveSubpathImport(
    specifier,
    { directory, imports: manifests.get(directory)?.imports },
    exists,
  );
};

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

/** The packages a manifest depends on, of any kind. */
export const dependencyNamesOf = (manifest: Manifest): string[] =>
  dependencyFields.flatMap((field) => {
    const dependencies = manifest[field];
    return typeof dependencies === "object" && dependencies !== null
      ? Object.keys(dependencies)
      : [];
  });

const parseManifest = (source: string): Manifest | null => {
  try {
    const parsed: unknown = JSON.parse(source);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Manifest)
      : null;
  } catch {
    return null;
  }
};

const directoryOfManifest = (path: string): string =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

/** Every `package.json` at `head`, by directory; one that does not parse is left out. */
export const readManifests = async (
  checkout: string,
  head: string,
  tree: readonly string[],
): Promise<Map<string, Manifest>> => {
  const manifestPaths = tree.filter(
    (path) =>
      (path === "package.json" || path.endsWith("/package.json")) &&
      !path.split("/").includes("node_modules"),
  );
  const contents = await catFiles(checkout, head, manifestPaths);
  const manifests = new Map<string, Manifest>();
  for (const [path, source] of contents) {
    const manifest = parseManifest(source);
    if (manifest !== null) manifests.set(directoryOfManifest(path), manifest);
  }
  return manifests;
};
