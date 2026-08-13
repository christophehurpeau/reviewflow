export const cleanTitle = (
  title: string,
  enableConventionalCommit: boolean,
): string => {
  const cleaned = title.trim().replace(
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    /[\s-]+\[?\s*([A-Za-z][\dA-Za-z]+-|[A-Z][\dA-Z]+[\s-]+)(\d+)\s*(?:\]\s*)?$/,
    (s, arg1, arg2) => ` ${arg1.replace(/[\s-]+$/, "").toUpperCase()}-${arg2}`,
  );

  if (!enableConventionalCommit) {
    return cleaned;
  }

  return (
    cleaned
      .replace(
        /^([A-Z]+)\/([A-Z_-]+)\/\s*/i,
        (s, arg1, arg2) => `${arg1.toLowerCase()}(${arg2}): `,
      )
      .replace(/^([A-Z]+)[/:;]\s*/i, (s, arg1) => `${arg1.toLowerCase()}: `)
      .replace(
        /\s+(?:-\s*)?[()[\]]\s*no[\s-]*isss?ue\s*[()[\]]$/i,
        " [no issue]",
      )
      .replace(
        /\s+(?:-\s*)?[()[\]]\s*no[\s-]*ticket\s*[()[\]]$/i,
        " [no ticket]",
      )
      .replace(/^Revert "([^"]+)"( \[no (?:issue|ticket)\])?$/, "revert: $1$2")
      // eslint-disable-next-line regexp/no-unused-capturing-group, regexp/no-super-linear-backtracking, regexp/no-misleading-capturing-group
      .replace(/^(revert:.*)(\s+\(#\d+\))( \[no (?:issue|ticket)\])?$/, "$1$3")
      .replace(/^(?:revert: ){2}/, "")
  );
};
