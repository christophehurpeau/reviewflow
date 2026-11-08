export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The app's config text as an object, a blank text being an empty config.
 * `null` when the text is not a json object: the user's own text is not
 * guessed at.
 */
export const parseConfigText = (
  source: string,
): Record<string, unknown> | null => {
  if (source.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  return isRecord(parsed) ? parsed : null;
};

export const stringifyConfig = (config: Record<string, unknown>): string =>
  `${JSON.stringify(config, null, 2)}\n`;
