/** "1 file", "2 files"; `plural` defaults to `word` + "s". */
export const pluralOf = (
  count: number,
  word: string,
  plural = `${word}s`,
): string => `${String(count)} ${count === 1 ? word : plural}`;
