import { parseConfigText, stringifyConfig } from "./parseConfigText.ts";

/** `defaultRepoPath` as the config text sets it, `undefined` when unset or unreadable. */
export const readDefaultRepoPathSetting = (
  source: string,
): string | undefined => {
  const value = parseConfigText(source)?.defaultRepoPath;
  return typeof value === "string" ? value : undefined;
};

/**
 * The config text with `defaultRepoPath` set to `path`, or removed when `path`
 * is blank so the built-in default applies. Rewritten as two-space json, other
 * keys kept; a new key goes first. `null` when the text is not a json object.
 */
export const writeDefaultRepoPathSetting = (
  source: string,
  path: string,
): string | null => {
  const config = parseConfigText(source);
  if (config === null) return null;
  const trimmed = path.trim();
  if (trimmed === "") {
    const { defaultRepoPath: _removed, ...rest } = config;
    return stringifyConfig(rest);
  }
  return stringifyConfig(
    "defaultRepoPath" in config
      ? { ...config, defaultRepoPath: trimmed }
      : { defaultRepoPath: trimmed, ...config },
  );
};
