export interface InsertedCheckoutEntry {
  /** the config text with the entry in `repos` */
  source: string;
  /** where the path goes: between the quotes of the entry's value */
  cursor: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `"owner/repo": ""` added to `repos` of the app's config text, so an editor
 * can open on it with the cursor where the checkout path is typed. Nothing is
 * saved here. An entry already present (names are compared case-insensitively,
 * as GitHub's are) is left as it is, with the cursor in its value. The text is
 * rewritten as two-space json, other keys kept; a blank text becomes a new
 * config. `null` when the text is not a json object whose `repos` is an object:
 * the user's own text is not guessed at.
 */
export const insertCheckoutEntry = (
  source: string,
  ownerRepo: string,
): InsertedCheckoutEntry | null => {
  let parsed: unknown;
  if (source.trim() === "") {
    parsed = {};
  } else {
    try {
      parsed = JSON.parse(source);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed)) return null;
  const repos = parsed.repos ?? {};
  if (!isRecord(repos)) return null;

  const wanted = ownerRepo.toLowerCase();
  const existing = Object.keys(repos).find(
    (key) => key.toLowerCase() === wanted,
  );
  const key = existing ?? ownerRepo;
  const next = existing === undefined ? { ...repos, [key]: "" } : repos;
  const text = `${JSON.stringify({ ...parsed, repos: next }, null, 2)}\n`;

  // the value follows the key on the same line; the same key may appear
  // earlier under another top-level key
  const marker = `${JSON.stringify(key)}: "`;
  const reposAt = text.indexOf('\n  "repos": ');
  const at = text.indexOf(marker, reposAt);
  if (at === -1) return null;
  const value = at + marker.length;
  return { source: text, cursor: value };
};
