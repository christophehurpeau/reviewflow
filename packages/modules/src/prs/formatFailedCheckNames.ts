/**
 * A pull request can fail dozens of checks at once. Both the webapp row and the
 * slack message list the names, so the selection is shared here while each
 * surface keeps its own markup.
 */
export const maxDisplayedFailedCheckNames = 9;

export interface DisplayedFailedCheckNames {
  names: string[];
  remaining: number;
}

export const splitFailedCheckNames = (
  failedNames: string[],
): DisplayedFailedCheckNames => ({
  names: failedNames.slice(0, maxDisplayedFailedCheckNames),
  remaining: Math.max(failedNames.length - maxDisplayedFailedCheckNames, 0),
});
