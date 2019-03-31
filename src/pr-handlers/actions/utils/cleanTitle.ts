export const cleanTitle = (title: string): string =>
  title
    .trim()
    .replace(/[\s-]+\[?\s*(ONK-\d+)\s*]?\s*$/, ' $1')
    .replace(/^([A-Za-z]+)[/:]\s*/, (s, arg1) => `${arg1.toLowerCase()}: `)
    .replace(/^Revert "([^"]+)"$/, 'revert: $1')
    // eslint-disable-next-line unicorn/no-unsafe-regex
    .replace(/^(revert:.*)(\s+\(#\d+\))$/, '$1');
