import type {
  PullRequestEdit,
  PullRequestFilesResponse,
  PullRequestPart,
} from "../api/pullRequest.ts";
import { pullRequestParts } from "./pullRequestPart.ts";

/**
 * The parts of the pull request screen an edit GitHub took makes stale, the
 * ones read again after it rather than the whole screen. An edit GitHub also
 * lists as an event (a label, a reviewer, a rename, a close) stales the
 * timeline with the header. A viewed mark stales nothing: what it changes is
 * known, and applied in place with `withFileViewed` by the daemon's last read
 * and the screen alike — reviewflow's fingerprint does not move on one, so
 * only that keeps the last read from serving the mark it replaced.
 */
export const pullRequestPartsStaleAfter = (
  edit: PullRequestEdit,
  pullRequestId: string,
): readonly PullRequestPart[] => {
  switch (edit.kind) {
    case "applySuggestions":
    case "updateBranch": {
      return pullRequestParts;
    }
    case "body": {
      return ["detail"];
    }
    case "reaction": {
      return edit.subjectId === pullRequestId ? ["detail"] : ["timeline"];
    }
    case "viewed": {
      return [];
    }
    case "comment":
    case "editComment":
    case "inlineComment":
    case "reply":
    case "resolveThread": {
      return ["timeline"];
    }
    case "review":
    case "startReview": {
      // the header's verdicts and merge state, and the files' "since my last review"
      return ["detail", "timeline", "files"];
    }
    case "assignees":
    case "draft":
    case "labels":
    case "merge":
    case "reviewers":
    case "state":
    case "title": {
      return ["detail", "timeline"];
    }
    default: {
      return edit satisfies never;
    }
  }
};

/** A path past the first page of files is not held, and is left as it is. */
export const withFileViewed = (
  files: PullRequestFilesResponse,
  path: string,
  viewed: boolean,
): PullRequestFilesResponse => ({
  ...files,
  files: files.files.map((file) =>
    file.path === path
      ? { ...file, viewed: viewed ? "viewed" : "unviewed" }
      : file,
  ),
});

/**
 * Whether an edit changes what a board row holds of the pull request: its
 * state, its review decision, its checks. A comment or a reaction does not
 * cost the board a read.
 */
export const pullRequestEditMovesBoard = (edit: PullRequestEdit): boolean => {
  switch (edit.kind) {
    case "applySuggestions":
    case "draft":
    case "merge":
    case "review":
    case "reviewers":
    case "startReview":
    case "state":
    case "updateBranch": {
      return true;
    }
    case "assignees":
    case "body":
    case "comment":
    case "editComment":
    case "inlineComment":
    case "labels":
    case "reaction":
    case "reply":
    case "resolveThread":
    case "title":
    case "viewed": {
      return false;
    }
    default: {
      return edit satisfies never;
    }
  }
};
