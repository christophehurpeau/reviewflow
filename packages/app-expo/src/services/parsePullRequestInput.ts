import type { PullRequestRef } from "@reviewflow/sdk";

const name = "[\\w.-]+";
const patterns = [
  // https://github.com/o/r/pull/n, with any tail (/files, ?query, #fragment)
  new RegExp(
    `^(?:https?://)?(?:www\\.)?github\\.com/(${name})/(${name})/pull/(\\d+)(?:[/?#].*)?$`,
    "i",
  ),
  // o/r#n
  new RegExp(`^(${name})/(${name})#(\\d+)$`),
  // o/r/n
  new RegExp(`^(${name})/(${name})/(\\d+)$`),
];

/** `https://github.com/o/r/pull/n`, `o/r#n` or `o/r/n`; null for anything else. */
export const parsePullRequestInput = (input: string): PullRequestRef | null => {
  const text = input.trim();
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match !== null) {
      const number = Number(match[3]);
      if (number >= 1) return { ownerRepo: `${match[1]}/${match[2]}`, number };
    }
  }
  return null;
};
