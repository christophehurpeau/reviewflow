import type { KnownBlock } from "@slack/web-api";
import type { ReviewflowPr } from "reviewflow-core";
import { toPrSummary } from "reviewflow-core";
import type { PrSummary, PrUserSummary } from "reviewflow-modules";
import { splitFailedCheckNames } from "reviewflow-modules";
import type { OctokitRestCompat } from "../octokit.ts";
import { ExcludesFalsy } from "../utils/Excludes.ts";
import {
  createLink,
  createPrChangesInformationFromReviewflowPr,
} from "./utils.ts";

export type GithubSearchResponse = Awaited<
  ReturnType<OctokitRestCompat["search"]["issuesAndPullRequests"]>
>;

/**
 * A section title already states the bucket every row in it belongs to, so a row
 * repeats neither the draft state nor a green build where that is the point of
 * the section.
 */
export interface PrRowOptions {
  showDraft?: boolean;
  showPassedChecks?: boolean;
  /**
   * Someone else's pull request requests a review, your own waits for one, so
   * the section the row sits in decides the verb.
   */
  reviewRequestVerb?: "awaiting" | "requested";
}

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

const pluralize = (count: number, word: string): string =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

const joinSegments = (segments: (string | undefined)[]): string =>
  segments.filter((segment) => segment !== undefined).join(" · ");

const formatFailedNames = (failedNames: string[]): string => {
  const { names, remaining } = splitFailedCheckNames(failedNames);
  const listed = names.map((name) => `\`${name}\``).join(", ");
  return `${failedNames.length > 1 ? "checks" : "check"} failed: ${listed}${
    remaining > 0 ? ` +${remaining}` : ""
  }`;
};

const formatChecks = (
  { conclusion, runningCount }: PrSummary["checks"],
  showPassedChecks: boolean,
): string | undefined => {
  if (conclusion === "in-progress") {
    return `${pluralize(runningCount, "check")} running`;
  }
  if (conclusion === "passed" && showPassedChecks) return "checks passed";
  return undefined;
};

const formatLogins = (users: PrUserSummary[]): string =>
  users.map(({ login }) => `@${login}`).join(", ");

const formatReviewRequests = (
  { requestedReviewers, requestedTeams }: PrSummary,
  verb: NonNullable<PrRowOptions["reviewRequestVerb"]>,
  userLogin: string,
): string | undefined => {
  if (requestedReviewers.length === 0 && requestedTeams.length === 0) {
    return undefined;
  }
  return `${verb} ${[
    ...requestedReviewers.map(({ login }) =>
      login === userLogin ? "_YOU_" : `@${login}`,
    ),
    ...requestedTeams.map((team) => `#${team}`),
  ].join(", ")}`;
};

const createAuthorElements = ({
  assignees,
  creator,
}: PrSummary): (ImageElement | MrkdwnElement)[] => {
  const users =
    assignees.length > 0 ? assignees : [creator].filter(ExcludesFalsy);

  return users.flatMap((user) => {
    const elements: (ImageElement | MrkdwnElement)[] = [];
    if (user.avatarUrl) {
      elements.push({
        type: "image",
        image_url: user.avatarUrl,
        alt_text: user.login,
      });
    }
    elements.push({ type: "mrkdwn", text: user.login });
    return elements;
  });
};

const formatDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });

export const createBlocksForPrSummary = (
  pr: PrSummary,
  userLogin: string,
  changesInformation: string | null,
  {
    showDraft = true,
    showPassedChecks = true,
    reviewRequestVerb = "awaiting",
  }: PrRowOptions = {},
): KnownBlock[] => {
  const prFullName = `${pr.repoName}#${pr.number}`;
  const hasFailure = pr.checks.failedNames.length > 0 || pr.lintFailed;

  const title = joinSegments([
    createLink(pr.url, prFullName),
    showDraft && pr.isDraft ? "_Draft_" : undefined,
    ...pr.statusLinks
      .filter(({ type }) => type === "success")
      .map(({ url, label }) => createLink(url, label)),
    `*${createLink(pr.url, pr.title)}*`,
  ]);

  // the section title says which bucket a row is in, but not that its build broke
  const status = joinSegments([
    changesInformation
      ? createLink(`${pr.url}/files`, changesInformation)
      : undefined,
    pr.checks.failedNames.length > 0
      ? formatFailedNames(pr.checks.failedNames)
      : undefined,
    pr.lintFailed ? "pr lint failed" : undefined,
    pr.changesRequestedBy.length > 0
      ? `changes requested by ${formatLogins(pr.changesRequestedBy)}`
      : undefined,
    formatChecks(pr.checks, showPassedChecks),
    pr.approvedCount > 0 ? pluralize(pr.approvedCount, "approval") : undefined,
    formatReviewRequests(pr, reviewRequestVerb, userLogin),
  ]);

  const date = pr.approvedAt ?? pr.openedAt;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${hasFailure ? ":red_circle: " : ""}${title}`,
      },
    },
    {
      type: "context",
      elements: [
        ...createAuthorElements(pr),
        ...(status ? [{ type: "mrkdwn" as const, text: status }] : []),
        ...(date
          ? [
              {
                type: "mrkdwn" as const,
                text: `${pr.approvedAt ? "Approved" : "Opened"} ${formatDate(date)}`,
              },
            ]
          : []),
      ],
    },
  ];
};

export const createBlocksForDataFromMongoPr = (
  pr: ReviewflowPr,
  userLogin: string,
  options?: PrRowOptions,
): KnownBlock[] =>
  createBlocksForPrSummary(
    toPrSummary(pr),
    userLogin,
    createPrChangesInformationFromReviewflowPr(pr),
    options,
  );

export const buildBlocksForDataFromGithubAndMongo = (
  userLogin: string,
  title: string,
  response: GithubSearchResponse | undefined,
  mongoResponse: ReviewflowPr[] = [],
  options?: PrRowOptions,
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
        return createBlocksForDataFromMongoPr(prFromMongo, userLogin, options);
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
            text: joinSegments([
              createLink(prFromGithub.html_url, prFullName),
              prFromGithub.draft ? "_Draft_" : undefined,
              `*${createLink(prFromGithub.html_url, prFromGithub.title)}*`,
            ]),
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
  userLogin: string,
  title: string,
  results: ReviewflowPr[],
  options?: PrRowOptions,
): KnownBlock[] => {
  if (results.length === 0) return [];

  return [
    createTitleBlock(title),
    createDividerBlock(),
    ...results.flatMap((pr) =>
      createBlocksForDataFromMongoPr(pr, userLogin, options),
    ),
    createPlaceholderImageBlock(),
  ];
};
