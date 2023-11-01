export const cleanTitle = (title: string): string =>
  title
    .trim()
    .replace(
      /[\s-]+\[?\s*([A-Za-z][\dA-Za-z]+-|[A-Z][\dA-Z]+[\s-]+)(\d+)\s*(?:]\s*)?$/,
      (s, arg1, arg2) =>
        ` ${arg1.replace(/[\s-]+$/, '').toUpperCase()}-${arg2}`,
    )
    .replace(/^([A-Za-z]+)[/:]\s*/, (s, arg1) => `${arg1.toLowerCase()}: `)
    .replace(/\s+(-\s*)?[()[\]]\s*no[\s-]*isss?ue\s*[()[\]]$/i, ' [no issue]')
    .replace(/^Revert "([^"]+)"( \[no issue])?$/, 'revert: $1$2')
    .replace(/^(revert:.*)(\s+\(#\d+\))( \[no issue])?$/, '$1$3');
