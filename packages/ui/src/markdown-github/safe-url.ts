/**
 * GitHub's sanitizer drops a `javascript:` href and an `src` it cannot load; so
 * does this. A relative url is refused too: it was relative to a repository
 * this renderer does not know.
 */
export const isSafeUrl = (
  value: string,
  protocols: readonly string[] = ["http:", "https:", "mailto:"],
): boolean => {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
