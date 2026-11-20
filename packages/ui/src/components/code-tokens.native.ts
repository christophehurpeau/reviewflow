import type { CodeToken } from "./code-tokens.ts";

/**
 * What metro picks on a native platform: the token colors are CSS custom
 * properties, which react-native cannot read, so a code block stays plain.
 */
export const highlightCode = (
  _language: string | undefined,
  _code: string,
): CodeToken[] | null => null;
