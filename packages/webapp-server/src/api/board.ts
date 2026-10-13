import type {
  MongoStores,
  PrBucketAccount,
  ReviewflowPr,
} from "reviewflow-core";
import { buildPrBucketQuery, createToPrDetail } from "reviewflow-core";
import type { PrBucket, PrBucketGroup, PrDetail } from "reviewflow-modules";
import {
  prBucketDisplay,
  prBucketGroupTitles,
  prBucketsInGroup,
} from "reviewflow-modules";
import { ApiError } from "./apiErrors.ts";
import type { ApiAuth } from "./authenticatePersonalToken.ts";
import { resolveTokenAccounts } from "./tokenAccounts.ts";

/** same page size as the webapp board */
export const boardPageSize = 100;

/** the groups in display order: the order `prBucketsInOrder` already has */
const groupsInOrder: PrBucketGroup[] = ["requesting-attention", "in-progress"];

export interface BoardBucket {
  key: PrBucket;
  title: string;
  total: number;
  prs: PrDetail[];
  nextPage: string | null;
}

export interface BoardGroup {
  key: PrBucketGroup;
  title: string;
  buckets: BoardBucket[];
}

/**
 * Page tokens are opaque to clients: today the offset of the page's first
 * pull request, base64url encoded. Offsets drift when a pull request enters
 * or leaves the bucket between two pages, as they do for any live list.
 */
const offsetPrefix = "offset:";
const maxOffset = 1_000_000;

const encodePage = (offset: number): string =>
  Buffer.from(`${offsetPrefix}${offset}`).toString("base64url");

export const parsePage = (page: string | undefined): number => {
  if (page === undefined) return 0;
  const decoded = Buffer.from(page, "base64url").toString("utf8");
  const match = /^offset:([1-9]\d{0,6})$/.exec(decoded);
  const offset = match ? Number(match[1]) : undefined;
  // the canonical encoding only: a token is never a free-form input
  if (
    offset === undefined ||
    offset > maxOffset ||
    encodePage(offset) !== page
  ) {
    throw new ApiError("badRequest", "`page` is not a page token of this API");
  }
  return offset;
};

export const parseBucket = (bucket: string | undefined): PrBucket => {
  if (bucket === undefined || !Object.hasOwn(prBucketDisplay, bucket)) {
    throw new ApiError("badRequest", "`bucket` is not a known board bucket");
  }
  return bucket as PrBucket;
};

/**
 * The accounts the board spans, from what the token reads: `account` omitted
 * is the webapp's `accountId: null`, every readable account. A login the
 * token cannot read is `forbidden`, whether or not it exists.
 */
export const resolveBoardAccounts = async (
  mongoStores: MongoStores,
  auth: ApiAuth,
  account: string | undefined,
): Promise<PrBucketAccount[]> => {
  const tokenAccounts = await resolveTokenAccounts(mongoStores, auth);
  const selected =
    account === undefined
      ? tokenAccounts
      : tokenAccounts.filter(
          ({ login }) => login.toLowerCase() === account.toLowerCase(),
        );
  if (selected.length === 0) {
    throw new ApiError("forbidden", "The token cannot read this account");
  }
  return selected.map(({ id, teams }) => ({ accountId: id, teams }));
};

export interface BoardReader {
  userId: number;
  accounts: PrBucketAccount[];
}

/** one page of one bucket, with the bucket's membership and order from core */
export const readBoardBucket = async (
  mongoStores: MongoStores,
  reader: BoardReader,
  bucket: PrBucket,
  offset: number,
  toPrDetail: (pr: ReviewflowPr) => PrDetail,
): Promise<BoardBucket> => {
  const { criteria, sort } = buildPrBucketQuery(bucket, reader);

  const [total, prs] = await Promise.all([
    mongoStores.prs.count(criteria),
    mongoStores.prs
      .createQueryCollection({
        criteria,
        // equal dates would let a pull request straddle two pages
        sort: { ...sort, _id: -1 },
        skip: offset,
        limit: boardPageSize,
        transformer: (pr: ReviewflowPr) => pr,
      })
      .fetch(({ result }) => result),
  ]);

  const nextOffset = offset + boardPageSize;
  return {
    key: bucket,
    title: prBucketDisplay[bucket].title,
    total,
    prs: prs.map((pr) => toPrDetail(pr)),
    nextPage: nextOffset < total ? encodePage(nextOffset) : null,
  };
};

export const readBoard = async (
  mongoStores: MongoStores,
  auth: ApiAuth,
  account: string | undefined,
): Promise<{ groups: BoardGroup[] }> => {
  const reader = {
    userId: auth.user.id,
    accounts: await resolveBoardAccounts(mongoStores, auth, account),
  };
  const toPrDetail = createToPrDetail(reader);

  return {
    groups: await Promise.all(
      groupsInOrder.map(async (group): Promise<BoardGroup> => ({
        key: group,
        title: prBucketGroupTitles[group],
        buckets: await Promise.all(
          prBucketsInGroup(group).map((bucket) =>
            readBoardBucket(mongoStores, reader, bucket, 0, toPrDetail),
          ),
        ),
      })),
    ),
  };
};

export const readBucketPage = async (
  mongoStores: MongoStores,
  auth: ApiAuth,
  {
    bucket,
    account,
    page,
  }: { bucket: PrBucket; account: string | undefined; page: number },
): Promise<BoardBucket> => {
  const reader = {
    userId: auth.user.id,
    accounts: await resolveBoardAccounts(mongoStores, auth, account),
  };
  return readBoardBucket(
    mongoStores,
    reader,
    bucket,
    page,
    createToPrDetail(reader),
  );
};
