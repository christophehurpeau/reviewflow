import type { KnownBlock } from "@slack/web-api";
import type { ReviewflowPr } from "../mongo.ts";
import type { OctokitRestCompat } from "../octokit.ts";
import { ExcludesFalsy } from "../utils/Excludes.ts";
import {
  createLink,
  createPrChangesInformationFromReviewflowPr,
} from "./utils.ts";

export type GithubSearchResponse = Awaited<
  ReturnType<OctokitRestCompat["search"]["issuesAndPullRequests"]>
>;

export const buildPullRequestUrl = (
  reviewflowPullRequest: ReviewflowPr,
): string =>
  `https://github.com/${reviewflowPullRequest.account.login}/${reviewflowPullRequest.repo.name}/pull/${reviewflowPullRequest.pr.number}`;

export const createTitleBlock = (title: string): KnownBlock => ({
  type: "section",
  text: {
    type: "mrkdwn",
    text: `*${title}*`,
  },
});

export const createDividerBlock = (): KnownBlock => ({ type: "divider" });

export const createErrorBlock = (errorMessage: string): KnownBlock => ({
  type: "section",
  text: {
    type: "plain_text",
    text: errorMessage,
  },
});

export const createPlaceholderImageBlock = (): KnownBlock => ({
  type: "context",
  elements: [
    {
      type: "image",
      image_url:
        "https://api.slack.com/img/blocks/bkb_template_images/placeholder.png",
      alt_text: "placeholder",
    },
  ],
});

interface ImageElement {
  type: "image";
  image_url: string;
  alt_text: string;
}
interface MrkdwnElement {
  type: "mrkdwn";
  text: string;
}

export const createBlocksForDataFromMongoPr = (
  pr: ReviewflowPr,
): KnownBlock[] => {
  const repoName = pr.repo.name;
  const prFullName = `${repoName}#${pr.pr.number}`;
  const prUrl = buildPullRequestUrl(pr);
  const changesInformation = createPrChangesInformationFromReviewflowPr(pr);

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${createLink(prUrl, prFullName)}${pr.isDraft ? " · _Draft_" : ""} · *${createLink(prUrl, pr.title)}*`,
      },
    },
    {
      type: "context",
      elements: [
        ...(() => {
          if (pr.assignees && pr.assignees.length > 0) {
            return pr.assignees.flatMap((assignee) => {
              const elements: (ImageElement | MrkdwnElement)[] = [];
              if (assignee.avatar_url) {
                elements.push({
                  type: "image",
                  image_url: assignee.avatar_url,
                  alt_text: assignee.login,
                });
              }
              elements.push({ type: "mrkdwn", text: assignee.login });
              return elements;
            });
          }
          if (pr.creator) {
            const elements: (ImageElement | MrkdwnElement)[] = [];
            if (pr.creator.avatar_url) {
              elements.push({
                type: "image",
                image_url: pr.creator.avatar_url,
                alt_text: pr.creator.login,
              });
            }
            elements.push({ type: "mrkdwn", text: pr.creator.login });
            return elements;
          }
          return [] as const;
        })(),

        ...(changesInformation
          ? ([
              {
                type: "mrkdwn",
                text: createLink(`${prUrl}/files`, changesInformation),
              },
            ] as const)
          : []),

        ...(pr.flowDates?.approvedAt || pr.flowDates?.openedAt
          ? ([
              {
                type: "mrkdwn",
                text: `${pr.flowDates.approvedAt ? "Approved" : "Opened"} ${(
                  pr.flowDates.approvedAt || pr.flowDates.openedAt
                ).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                })}`,
              },
            ] as const)
          : []),
      ],
    },
  ] as const;
};

export const buildBlocksForDataFromGithubAndMongo = (
  title: string,
  response: GithubSearchResponse | undefined,
  mongoResponse: ReviewflowPr[] = [],
): KnownBlock[] => {
  if (!response) {
    return [
      createTitleBlock(title),
      createDividerBlock(),
      createErrorBlock("No response from GitHub"),
    ];
  }

  // octokit returns error shapes sometimes; guard against that
  if ((response as unknown as Record<string, unknown>).error !== undefined) {
    return [
      createTitleBlock(title),
      createDividerBlock(),
      createErrorBlock("Error from GitHub"),
    ];
  }

  const results = response.data;

  if (!results.total_count) return [];

  return [
    createTitleBlock(title),
    createDividerBlock(),
    ...results.items.flatMap((prFromGithub): KnownBlock[] => {
      const prFromMongo = mongoResponse.find(
        (prfm) =>
          prFromGithub.number === prfm.pr.number &&
          prFromGithub.repository_url ===
            `https://api.github.com/repos/${prfm.account.login}/${prfm.repo.name}`,
      );

      if (prFromMongo) {
        return createBlocksForDataFromMongoPr(prFromMongo);
      }

      const repoName = prFromGithub.repository_url.slice(
        "https://api.github.com/repos/".length,
      );
      const prFullName = `${repoName}#${prFromGithub.number}`;

      const elements: (ImageElement | MrkdwnElement)[] = [];
      if (prFromGithub.user?.avatar_url) {
        elements.push({
          type: "image",
          image_url: prFromGithub.user.avatar_url,
          alt_text: prFromGithub.user.login,
        });
      }
      if (prFromGithub.user) {
        elements.push({ type: "mrkdwn", text: prFromGithub.user.login });
      }

      return [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${createLink(prFromGithub.html_url, prFullName)} ${prFromGithub.draft ? "· _Draft_" : ""} · *${createLink(prFromGithub.html_url, prFromGithub.title)}*`,
          },
        },
        {
          type: "context",
          elements: elements.filter(ExcludesFalsy),
        },
      ];
    }),
    createPlaceholderImageBlock(),
  ];
};

export const buildBlocksForDataFromMongo = (
  title: string,
  results: ReviewflowPr[],
): KnownBlock[] => {
  if (results.length === 0) return [];

  return [
    createTitleBlock(title),
    createDividerBlock(),
    ...results.flatMap((pr) => createBlocksForDataFromMongoPr(pr)),
    createPlaceholderImageBlock(),
  ];
};
