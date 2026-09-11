import type { KnownBlock } from "@slack/web-api";
import type { ReviewflowPr } from "reviewflow-core";
import { toPrSummary } from "reviewflow-core";
import type {
  PrOwners,
  PrRowDisplayOptions,
  PrRowStatus,
  PrSummary,
} from "reviewflow-modules";
import {
  formatPrChanges,
  formatPrFlowDate,
  joinSegments,
  selectPrOwners,
  selectPrRowStatus,
} from "reviewflow-modules";
import type { OctokitRestCompat } from "../octokit.ts";
import { prsUrl } from "../webappUrl.ts";
import { createLink, createStartReviewLink } from "./utils.ts";

export type GithubSearchResponse = Awaited<
  ReturnType<OctokitRestCompat["search"]["issuesAndPullRequests"]>
>;

type GithubSearchItem = GithubSearchResponse["data"]["items"][number];

/**
 * A section title already states the bucket every row in it belongs to, so a row
 * repeats neither the draft state nor a green build where that is the point of
 * the section.
 */
export interface PrRowOptions extends Pick<
  PrRowDisplayOptions,
  "reviewRequestVerb" | "showDraft" | "showPassedChecks" | "showReRequests"
> {
  /** on where the viewer is the one being asked for the review */
  showStartReview?: boolean;
}

/** slack rejects a home view above this, publishing nothing at all */
export const maxHomeBlocks = 100;

/** the title, the divider, the trailing spacer and a possible `+X more` line */
const blocksPerSection = 4;

/** the title line and the context line under it */
const blocksPerRow = 2;

/** a context block above it, and slack drops the ones beyond */
const maxContextElements = 10;

/** the viewer reads as themselves where naming them is the point of the segment */
const slackSelfLabel = "_you_";

const wrapCheckName = (name: string): string => `\`${name}\``;

const createTitleBlock = (title: string): KnownBlock => ({
  type: "section",
  text: {
    type: "mrkdwn",
    text: `*${title}*`,
  },
});

const createDividerBlock = (): KnownBlock => ({ type: "divider" });

const createErrorBlock = (errorMessage: string): KnownBlock => ({
  type: "section",
  text: {
    type: "plain_text",
    text: errorMessage,
  },
});

/** a transparent image is the only vertical space block kit offers */
const createSpacerBlock = (): KnownBlock => ({
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

/** a context block, so it does not read as a section title of its own */
const createMoreBlock = (remaining: number): KnownBlock => ({
  type: "context",
  elements: [
    {
      type: "mrkdwn",
      text: createLink(prsUrl(), `+${remaining} more`),
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

/** what broke leads the line and is the one thing mrkdwn can emphasise */
const formatRowStatus = ({
  failed,
  changesRequested,
  isDraft,
  rest,
}: PrRowStatus): string | undefined =>
  joinSegments([
    failed ? `*${failed}*` : undefined,
    changesRequested,
    isDraft ? "_draft_" : undefined,
    rest || undefined,
  ]) || undefined;

/**
 * The faces of everyone the owners label names, then the label itself, then
 * everything else the row states, all within the ten elements a context block
 * takes: a pull request with a dozen assignees would otherwise take the whole
 * home view down with it.
 */
const createRowContextBlock = (
  owners: PrOwners | undefined,
  texts: (string | undefined)[],
): KnownBlock | undefined => {
  const textElements = texts
    .filter((text) => text !== undefined)
    .map((text): MrkdwnElement => ({ type: "mrkdwn", text }));

  const avatars = (owners?.users ?? [])
    .flatMap((user): ImageElement[] =>
      user.avatarUrl
        ? [{ type: "image", image_url: user.avatarUrl, alt_text: user.login }]
        : [],
    )
    .slice(0, maxContextElements - textElements.length);

  const elements = [...avatars, ...textElements];
  if (elements.length === 0) return undefined;

  return { type: "context", elements };
};

const createBlocksForPrSummary = (
  pr: PrSummary,
  userLogin: string,
  {
    showStartReview = false,
    ...displayOptions
  }: PrRowDisplayOptions & PrRowOptions = {},
): KnownBlock[] => {
  const owners = selectPrOwners(pr, {
    currentUserLogin: userLogin,
    selfLabel: slackSelfLabel,
  });

  const title = joinSegments([
    createLink(pr.url, `${pr.repoName}#${pr.number}`),
    ...pr.statusLinks
      .filter(({ type }) => type === "success")
      .map(({ url, label }) => createLink(url, label)),
    `*${createLink(pr.url, pr.title)}*`,
    pr.changes
      ? createLink(`${pr.url}/files`, formatPrChanges(pr.changes))
      : undefined,
    showStartReview ? createStartReviewLink(pr._id) : undefined,
  ]);

  const context = createRowContextBlock(owners, [
    owners?.label,
    formatRowStatus(
      selectPrRowStatus(pr, {
        ...displayOptions,
        currentUserLogin: userLogin,
        selfLabel: slackSelfLabel,
        wrapCheckName,
      }),
    ),
    formatPrFlowDate(pr),
  ]);

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: title },
    },
    ...(context ? [context] : []),
  ];
};

export const createBlocksForDataFromMongoPr = (
  pr: ReviewflowPr,
  userLogin: string,
  options?: PrRowOptions,
): KnownBlock[] =>
  createBlocksForPrSummary(toPrSummary(pr), userLogin, options);

/**
 * How many rows each section may render to keep the whole view under the block
 * limit, given a budget already reduced by whatever the home spends outside the
 * sections. Rows are handed out one section at a time, round by round: spending
 * the budget in order would let a bucket of forty requested reviews starve the
 * ones the home deliberately ranks after it.
 */
export const allocateRowBudget = (
  counts: number[],
  budget: number,
): number[] => {
  const allocated = counts.map(() => 0);
  const sectionCount = counts.filter((count) => count > 0).length;
  if (sectionCount === 0) return allocated;

  let remaining = Math.max(
    Math.floor((budget - blocksPerSection * sectionCount) / blocksPerRow),
    0,
  );

  let served = true;
  while (remaining > 0 && served) {
    served = false;
    for (const [index, count] of counts.entries()) {
      if (remaining === 0) break;
      if (allocated[index]! >= count) continue;
      allocated[index]! += 1;
      remaining -= 1;
      served = true;
    }
  }

  return allocated;
};

interface SectionBlocksOptions {
  title: string;
  /** what the section holds, before the budget truncates it */
  totalCount: number;
  rows: KnownBlock[][];
}

const createSectionBlocks = ({
  title,
  totalCount,
  rows,
}: SectionBlocksOptions): KnownBlock[] => {
  const remaining = totalCount - rows.length;

  return [
    createTitleBlock(title),
    createDividerBlock(),
    ...rows.flat(),
    ...(remaining > 0 ? [createMoreBlock(remaining)] : []),
    createSpacerBlock(),
  ];
};

export interface BuildBlocksFromMongoOptions {
  userLogin: string;
  title: string;
  results: ReviewflowPr[];
  /** how many rows the block budget leaves this section */
  limit?: number;
  rowOptions?: PrRowOptions;
}

export const buildBlocksForDataFromMongo = ({
  userLogin,
  title,
  results,
  limit = results.length,
  rowOptions,
}: BuildBlocksFromMongoOptions): KnownBlock[] => {
  if (results.length === 0) return [];

  return createSectionBlocks({
    title,
    totalCount: results.length,
    rows: results
      .slice(0, limit)
      .map((pr) => createBlocksForDataFromMongoPr(pr, userLogin, rowOptions)),
  });
};

const isSameGithubPr = (
  prFromGithub: GithubSearchItem,
  prFromMongo: ReviewflowPr,
): boolean =>
  prFromGithub.number === prFromMongo.pr.number &&
  prFromGithub.repository_url ===
    `https://api.github.com/repos/${prFromMongo.account.login}/${prFromMongo.repo.name}`;

/**
 * The github search returns every pending review request, including the ones a
 * previous review moved to another bucket. That bucket has its own section and
 * is not part of this one's mongo results, so its rows would otherwise appear a
 * second time here, marked as untracked.
 */
export const excludeGithubPrsInMongoResults = (
  items: GithubSearchItem[],
  excludedResults: ReviewflowPr[],
): GithubSearchItem[] =>
  excludedResults.length === 0
    ? items
    : items.filter(
        (item) =>
          !excludedResults.some((prFromMongo) =>
            isSameGithubPr(item, prFromMongo),
          ),
      );

/** a pull request the github search returned that reviewflow has no document for */
export interface UntrackedPr {
  repoFullName: string;
  number: number;
  url: string;
}

export interface BuildBlocksFromGithubAndMongoOptions {
  userLogin: string;
  title: string;
  response: GithubSearchResponse | undefined;
  mongoResults?: ReviewflowPr[];
  /** rows another section already renders, dropped from this one */
  excludedResults?: ReviewflowPr[];
  /** how many rows the block budget leaves this section */
  limit?: number;
  rowOptions?: PrRowOptions;
  /** reports the rows only github knows about; the caller owns the logger */
  onUntrackedPr?: (pr: UntrackedPr) => void;
}

export const buildBlocksForDataFromGithubAndMongo = ({
  userLogin,
  title,
  response,
  mongoResults = [],
  excludedResults = [],
  limit,
  rowOptions,
  onUntrackedPr,
}: BuildBlocksFromGithubAndMongoOptions): KnownBlock[] => {
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

  const items = excludeGithubPrsInMongoResults(results.items, excludedResults);

  if (items.length === 0) return [];

  return createSectionBlocks({
    title,
    // github caps its search page, so the count it reports outlives the items
    totalCount: Math.max(
      results.total_count - (results.items.length - items.length),
      items.length,
    ),
    rows: items
      .slice(0, limit ?? items.length)
      .map((prFromGithub): KnownBlock[] => {
        const prFromMongo = mongoResults.find((trackedPr) =>
          isSameGithubPr(prFromGithub, trackedPr),
        );

        if (prFromMongo) {
          return createBlocksForDataFromMongoPr(
            prFromMongo,
            userLogin,
            rowOptions,
          );
        }

        const repoName = prFromGithub.repository_url.slice(
          "https://api.github.com/repos/".length,
        );

        onUntrackedPr?.({
          repoFullName: repoName,
          number: prFromGithub.number,
          url: prFromGithub.html_url,
        });

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
                createLink(
                  prFromGithub.html_url,
                  `${repoName}#${prFromGithub.number}`,
                ),
                `*${createLink(prFromGithub.html_url, prFromGithub.title)}*`,
                prFromGithub.draft ? "_draft_" : undefined,
                "_not tracked by reviewflow_",
              ]),
            },
          },
          ...(elements.length > 0
            ? [{ type: "context" as const, elements }]
            : []),
        ];
      }),
  });
};
