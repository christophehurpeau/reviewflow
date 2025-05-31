import type { PullRequestWithDecentData } from "../utils/PullRequestData";
import type { ParsedBody } from "./utils/body/parseBody";
import type { Options } from "./utils/body/prOptions";

interface CreateCommitMessageOptions {
  pullRequest: PullRequestWithDecentData;
  parsedBody: ParsedBody;
  options: Options;
}

export const createCommitMessage = ({
  pullRequest,
  parsedBody,
  options,
}: CreateCommitMessageOptions): [string, string] => {
  return [
    `${pullRequest.title}${options.autoMergeWithSkipCi ? " [skip ci]" : ""} (#${
      pullRequest.number
    })`,
    parsedBody.commitNotes
      ? parsedBody.commitNotes
          // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-misleading-capturing-group
          .replace(/^- (.*)\s*\([^)]+\)$/gm, "$1")
          .replace(/^Breaking Changes:\n/, "BREAKING CHANGE: ")
          .replace(/\n/g, "; ")
      : "",
  ];
};
