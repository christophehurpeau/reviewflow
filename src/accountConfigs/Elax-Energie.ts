import { githubPalette } from "./color-palettes/githubPalette";
import type { Config } from "./types";

const config: Config<never> = {
  autoAssignToCreator: true,
  cleanTitle: "conventionalCommit",
  lintPullRequestTitleWithConventionalCommit: /^(aquastats)$/,
  requiresReviewRequest: true,
  prDefaultOptions: {
    autoMerge: false,
    autoMergeWithSkipCi: false,
    deleteAfterMerge: true,
  },
  parsePR: {
    title: [
      {
        regExp: /\s([A-Z][\dA-Z]+-(\d+)|\[no (ticket|issue)])$/,
        status: "notion-ticket",
        createStatusInfo: (match, prInfo, isPrFromBot) => {
          if (match) {
            const ticket = match[1];
            if (ticket === "[no ticket]" || ticket === "[no issue]") {
              return {
                type: "success",
                title: "✓ No ticket",
                summary: "",
              };
            }

            const url = `https://www.notion.so/elaxenergie/${ticket}`;
            return {
              type: "success",
              inBody: true,
              title: `✓ Notion ticket: ${ticket}`,
              summary: `[${ticket}](${url})`,
              url,
            };
          }

          if (isPrFromBot) {
            return {
              type: "success",
              title: "Title does not have Notion ticket but PR created by bot",
              summary: "",
            };
          }

          return {
            type: "failure",
            title: "Title does not have Notion ticket",
            summary: "The PR title should end with GEN-0000, or [no ticket]",
          };
        },
      },
    ],
    body: [
      {
        bot: false,
        regExp: /^(.*)$/s,
        createStatusInfo: (match) => {
          const description = match?.[1];
          if (!description?.trim()) {
            return {
              type: "failure",
              title: "Body is empty",
              summary: "The PR body should not be empty",
            };
          }
          const descriptionStripTitlesAndComments = description
            .replace(/^\s*#+\s+.*/gm, "")
            .replace(/(<!--.*?-->)|(<!--[\S\s]+?-->)|(<!--[\S\s]*?$)/gs, "");

          if (!descriptionStripTitlesAndComments.trim()) {
            return {
              type: "failure",
              title: "Body has no meaningful content",
              summary:
                "The PR body should not contains only titles and comments",
            };
          }
          return null;
        },
      },
    ],
  },
  teams: {},
  labels: {
    list: {
      /* checks */
      "checks/failed": {
        name: ":green_heart: checks/fail",
        color: githubPalette.dangerEmphasis,
      },
      "checks/passed": {
        name: ":green_heart: checks/passed",
        color: githubPalette.successEmphasis,
      },

      /* infos */
      "breaking-changes": {
        name: ":warning: Breaking Changes",
        color: githubPalette.attentionEmphasis,
      },

      /* auto merge */
      "merge/automerge": {
        name: ":vertical_traffic_light: automerge",
        color: githubPalette.successEmphasis,
      },
      "merge/skip-ci": {
        name: ":vertical_traffic_light: skip-ci",
        color: githubPalette.scaleBlue1,
      },
      "merge/update-branch": {
        name: ":arrows_counterclockwise: update branch",
        color: githubPalette.accentEmphasis,
      },
    },
  },
};

export default config;
