import type { KnownBlock } from "@slack/web-api";
import { markdownToBlocks } from "@tryfabric/mack";
import { slackifyMarkdown } from "slackify-markdown";
import type { RepoContext } from "../context/repoContext.ts";
import { createMrkdwnSectionBlock } from "./slack/createSlackMessageWithSecondaryBlock.ts";

export const slackifyCommentBody = async (
  repoContext: RepoContext,
  body: string,
  multipleLines: boolean,
): Promise<KnownBlock[]> => {
  if (repoContext.config.experimentalFeatures?.betterSlackify) {
    return markdownToBlocks(
      body
        .replace("```suggestion", "_Suggested change:_\n```suggestion")
        .replace(
          "```suggestion\r\n```",
          `_Suggestion to remove line${multipleLines ? "s" : ""}._\n`,
        ),
    );
  }
  return [
    createMrkdwnSectionBlock(
      slackifyMarkdown(
        body
          .replace("```suggestion", "_Suggested change:_\n```suggestion")
          .replace(
            "```suggestion\r\n```",
            `_Suggestion to remove line${multipleLines ? "s" : ""}._\n`,
          )
          .slice(0, 2000),
      ),
    ),
  ];
};
