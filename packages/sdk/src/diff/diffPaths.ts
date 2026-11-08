const cEscapes: Record<string, number> = {
  a: 7,
  b: 8,
  f: 12,
  n: 10,
  r: 13,
  t: 9,
  v: 11,
  '"': 34,
  "\\": 92,
};

/** git quotes a name holding a quote, a backslash or a control character C-style, bytes in octal */
const unquoteGitPath = (quoted: string): string => {
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  for (let index = 1; index < quoted.length - 1; index++) {
    const char = quoted[index]!;
    if (char !== "\\") {
      bytes.push(...encoder.encode(char));
      continue;
    }
    const next = quoted[index + 1] ?? "";
    const octal = /^[0-7]{3}/.exec(quoted.slice(index + 1));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      index += 3;
    } else {
      bytes.push(cEscapes[next] ?? next.codePointAt(0) ?? 0);
      index += 1;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
};

/**
 * A `---`/`+++` name: git ends one holding a space with a tab, and quotes one
 * holding special characters; `prefix` is `a/` or `b/`.
 */
const unquoted = (name: string): string =>
  name.length > 1 && name.startsWith('"') && name.endsWith('"')
    ? unquoteGitPath(name)
    : name;

const headerName = (raw: string, prefix: string): string | null => {
  const name = unquoted(raw.endsWith("\t") ? raw.slice(0, -1) : raw);
  return name.startsWith(prefix) ? name.slice(prefix.length) : null;
};

/**
 * The file a block of a unified diff names after the change: `+++ b/…`, or
 * `--- a/…` for a deletion, or the header's second half for a binary file or a
 * pure rename, which carry no `+++` line.
 */
const pathOfBlock = (block: string): string | null => {
  const added = /^\+\+\+ (.*)$/m.exec(block)?.[1];
  const addedName = added === undefined ? null : headerName(added, "b/");
  if (addedName !== null) return addedName;
  const removed = /^--- (.*)$/m.exec(block)?.[1];
  const removedName = removed === undefined ? null : headerName(removed, "a/");
  if (removedName !== null) return removedName;
  const renamed = /^rename to (.*)$/m.exec(block)?.[1];
  if (renamed !== undefined) return unquoted(renamed);
  const header = block.split("\n", 1)[0] ?? "";
  const quotedSeparator = header.lastIndexOf(' "b/');
  if (quotedSeparator !== -1) {
    return headerName(header.slice(quotedSeparator + 1), "b/");
  }
  const separator = header.lastIndexOf(" b/");
  return separator === -1 ? null : header.slice(separator + 3);
};

export const diffPaths = (patch: string): string[] =>
  patch
    .split(/^diff --git /m)
    .slice(1)
    .map(pathOfBlock)
    .filter((path) => path !== null);
