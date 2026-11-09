import { githubPalette } from "./color-palettes/githubPalette.ts";
import type { Config, StatusInfo } from "./types.ts";

const dataImpactRepositoryName = "aquastats";
const pullRequestTemplateUrl =
  "https://github.com/Elax-Energie/aquastats/blob/main/.github/pull_request_template.md";
// the template links the database itself: pasting that link announces nothing
const dataImpactAnnouncementsDatabaseId = "402d75d1baf5807baf17c083611045ae";
const notionPageUrlRegExp =
  /https:\/\/(?:www\.|app\.)?notion\.(?:so|com)\/[^\s)>\]]*?([\da-f]{32}|[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})(?![\da-f])[^\s)>\]]*/gi;

const createDataImpactFailure = (
  title: string,
  summary: string,
): StatusInfo => ({
  type: "failure",
  inBody: true,
  title,
  summary,
  url: pullRequestTemplateUrl,
});

/** the template's own instructions live in an html comment inside the section */
const extractDataImpactSection = (body: string): string | undefined => {
  const bodyWithoutComments = body
    .replaceAll("\r\n", "\n")
    .replaceAll(/<!--[\s\S]*?(?:-->|$)/g, "");
  const sectionMatch =
    /^ {0,3}###[\t ]+data impact[\t ]*\n([\s\S]*?)(?=^ {0,3}#{1,3}[\t ]|(?![\s\S]))/im.exec(
      `${bodyWithoutComments}\n`,
    );
  return sectionMatch?.[1]?.trim();
};

const findAnnouncementPageUrl = (section: string): string | undefined =>
  [...section.matchAll(notionPageUrlRegExp)].find(
    ([, pageId]) =>
      pageId?.replaceAll("-", "").toLowerCase() !==
      dataImpactAnnouncementsDatabaseId,
  )?.[0];

/**
 * Checks the form of the `### Data impact` section of the aquastats pull request template:
 * `None`, or a link to its Notion announcement page. Whether the linked page belongs to the
 * announcements database cannot be told from its url, which only carries the page id.
 */
const createDataImpactStatusInfo = (body: string): StatusInfo => {
  const section = extractDataImpactSection(body);

  if (section === undefined) {
    return createDataImpactFailure(
      "Data impact section missing",
      "The PR body should have the ### Data impact section of the pull request template",
    );
  }

  if (!section) {
    return createDataImpactFailure(
      "Data impact section is empty",
      "The ### Data impact section should be None, or link its Notion announcement page",
    );
  }

  if (/^none\b/i.test(section)) {
    return { type: "success", title: "✓ Data impact: none", summary: "" };
  }

  const announcementPageUrl = findAnnouncementPageUrl(section);
  if (announcementPageUrl) {
    return {
      type: "success",
      inBody: true,
      title: "✓ Data impact announced",
      summary: `[Data impact](${announcementPageUrl})`,
      url: announcementPageUrl,
    };
  }

  if (/announcement not created/i.test(section)) {
    return createDataImpactFailure(
      "Data impact announcement not created",
      "Create the Notion announcement page, then paste its link in the ### Data impact section",
    );
  }

  return createDataImpactFailure(
    "Data impact announced without its Notion page link",
    "The ### Data impact section should be None, or link its Notion announcement page",
  );
};

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
        excludeRepositoryNames: ["elax-dagster"],
        regExp: /\s([A-Z][\dA-Z]+-(\d+)|\[no (ticket|issue)\])$/,
        status: "notion-ticket",
        createStatusInfo: (match, prInfo, isPrFromBot, repositoryName) => {
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

          if (repositoryName === "elax-dagster") {
            return {
              type: "success",
              title: "Title does not have Notion ticket.",
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
        status: "data-impact",
        createStatusInfo: (match, prInfo, isPrFromBot, repositoryName) =>
          repositoryName === dataImpactRepositoryName
            ? createDataImpactStatusInfo(match?.[1] ?? "")
            : null,
      },
    ],
  },
  // shown on the pull request without holding the automerge, until the data team makes it required
  checksAllowedToFail: ["reviewflow/data-impact"],
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

      /* auto approve */
      "review/auto-approve": {
        name: ":white_check_mark: bot approval",
        color: githubPalette.successEmphasis,
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
