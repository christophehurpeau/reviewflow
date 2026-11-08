import type {
  PullRequestDiffSide,
  PullRequestThread,
} from "../api/pullRequest.ts";
import type { PrState } from "../types/entities.ts";

const fenceOpen = /^( {0,3})(`{3,}(?!`)|~{3,}(?!~))(.*)$/;

const withoutIndent = (line: string, indent: number): string => {
  let index = 0;
  while (index < indent && line[index] === " ") index += 1;
  return line.slice(index);
};

/**
 * The ```` ```suggestion ```` blocks of a comment, each as the lines it puts
 * in place of the commented ones (none: it deletes them). Every fence is
 * walked, so a suggestion quoted inside another code block is not one. Like
 * CommonMark, a fence left open runs to the end of the comment.
 */
export const parseSuggestions = (body: string): string[][] => {
  const lines = body.replaceAll("\r\n", "\n").split("\n");
  const suggestions: string[][] = [];
  let index = 0;
  while (index < lines.length) {
    const open = fenceOpen.exec(lines[index] ?? "");
    index += 1;
    if (open === null) continue;
    const [, indent = "", fence = "", info = ""] = open;
    if (fence.startsWith("`") && info.includes("`")) continue;
    const close = new RegExp(
      `^ {0,3}${fence[0] ?? ""}{${String(fence.length)},}[ \\t]*$`,
    );
    const content: string[] = [];
    while (index < lines.length && !close.test(lines[index] ?? "")) {
      content.push(withoutIndent(lines[index] ?? "", indent.length));
      index += 1;
    }
    index += 1;
    if (info.trim().split(/\s/)[0] === "suggestion") suggestions.push(content);
  }
  return suggestions;
};

type SuggestionThread = Pick<
  PullRequestThread,
  | "diffHunk"
  | "line"
  | "originalLine"
  | "originalStartLine"
  | "side"
  | "startLine"
>;

const rangeLength = (
  start: number | null,
  end: number | null,
): number | null => {
  if (end === null) return null;
  return end - (start ?? end) + 1;
};

/**
 * The lines a suggestion of the thread replaces, read from the end of its
 * diff hunk, which GitHub cuts at the commented line. Null when the hunk
 * holds fewer of them than the range spans.
 */
export const suggestionOriginalLines = (
  thread: SuggestionThread,
): string[] | null => {
  const count =
    thread.line === null
      ? rangeLength(thread.originalStartLine, thread.originalLine)
      : rangeLength(thread.startLine, thread.line);
  if (count === null || count < 1) return null;
  const dropped = thread.side === "RIGHT" ? "-" : "+";
  const sideLines = thread.diffHunk
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("@@") &&
        !line.startsWith("\\") &&
        !line.startsWith(dropped),
    );
  if (sideLines.length < count) return null;
  return sideLines.slice(-count).map((line) => line.slice(1));
};

export interface SuggestionCommitFacts {
  state: PrState;
  viewerCanApplySuggestion: boolean;
  /** `parseSuggestions(body).length` */
  suggestionCount: number;
  outdated: boolean;
  /** the line on the head; null once gone from the diff */
  line: number | null;
  side: PullRequestDiffSide;
  startSide: PullRequestDiffSide | null;
}

/**
 * Why a comment's suggestion cannot be committed, or null. The screen shows
 * it on the disabled button; the daemon refuses with it, from GitHub's
 * current state of the thread.
 */
export const suggestionCommitRefusal = ({
  state,
  viewerCanApplySuggestion,
  suggestionCount,
  outdated,
  line,
  side,
  startSide,
}: SuggestionCommitFacts): string | null => {
  if (state === "closed" || state === "merged") {
    return `The pull request is ${state}`;
  }
  if (!viewerCanApplySuggestion) {
    return "GitHub does not let you commit to this pull request's branch";
  }
  if (suggestionCount === 0) return "The comment holds no suggestion";
  if (suggestionCount > 1) {
    return "The comment holds more than one suggestion: GitHub commits one per comment";
  }
  if (outdated || line === null) {
    return "Outdated: the lines it replaces changed since";
  }
  if (side === "LEFT" || startSide === "LEFT") {
    return "It is on removed lines, which the branch no longer has";
  }
  return null;
};

export interface SuggestionRange {
  path: string;
  startLine: number | null;
  line: number;
}

/** GitHub takes one suggestion per line in a batch. */
export const suggestionRangesOverlap = (
  a: SuggestionRange,
  b: SuggestionRange,
): boolean =>
  a.path === b.path &&
  (a.startLine ?? a.line) <= b.line &&
  (b.startLine ?? b.line) <= a.line;
