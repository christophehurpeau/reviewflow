import { parseConfigText, stringifyConfig } from "./parseConfigText.ts";

const repoPathsKeys = new Set(["repoPaths", "defaultRepoPath"]);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * The repositories folders as the config text sets them: `repoPaths`, or the
 * legacy `defaultRepoPath` as a one-folder list. `undefined` when neither is
 * set or the text is unreadable, so the built-in default applies.
 */
export const readRepoPathsSetting = (source: string): string[] | undefined => {
  const config = parseConfigText(source);
  if (config === null) return undefined;
  if (isStringArray(config.repoPaths)) return config.repoPaths;
  if (typeof config.defaultRepoPath === "string") {
    return [config.defaultRepoPath];
  }
  return undefined;
};

/**
 * The config text with `repoPaths` set to `paths`, trimmed, without blanks or
 * duplicates. It takes the place of the legacy `defaultRepoPath`, or goes
 * first. An empty list is written as is: it searches no folder, unlike an
 * unset key. Rewritten as two-space json, other keys kept. `null` when the
 * text is not a json object.
 */
export const writeRepoPathsSetting = (
  source: string,
  paths: readonly string[],
): string | null => {
  const config = parseConfigText(source);
  if (config === null) return null;
  const repoPaths = [
    ...new Set(paths.map((path) => path.trim()).filter((path) => path !== "")),
  ];
  const entries = Object.entries(config);
  const at = entries.findIndex(([key]) => repoPathsKeys.has(key));
  const others = entries.filter(([key]) => !repoPathsKeys.has(key));
  others.splice(Math.max(at, 0), 0, ["repoPaths", repoPaths]);
  return stringifyConfig(Object.fromEntries(others));
};
