import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ReviewflowPr } from "../mongo.ts";
import type { TestMongoStores } from "../tests/testMongoStores.ts";
import { createTestMongoStores } from "../tests/testMongoStores.ts";
import { prsMissingBranchFieldsCriteria } from "./prsMissingBranchFieldsCriteria.ts";

const createPr = (
  number: number,
  overrides: Partial<ReviewflowPr> = {},
  repoId = 10,
) => {
  const pr = {
    account: { id: 1, login: "acme", type: "Organization" },
    repo: { id: repoId, name: "acme/app" },
    pr: { number },
    commentId: 1,
    title: "title",
    isDraft: false,
    isClosed: false,
    headRef: "feature",
    baseRef: "main",
    headRepoFullName: "acme/app",
    ...overrides,
  };
  // an undefined value is stored as null, not left absent
  return Object.fromEntries(
    Object.entries(pr).filter(([, value]) => value !== undefined),
  ) as unknown as ReviewflowPr;
};

describe("prsMissingBranchFieldsCriteria", () => {
  let stores: TestMongoStores;

  beforeAll(async () => {
    stores = await createTestMongoStores();
    const prs = [
      createPr(1),
      createPr(2, { headRef: undefined }),
      createPr(3, { baseRef: undefined }),
      createPr(4, { headRepoFullName: undefined }),
      createPr(5, { headRepoFullName: null }),
      createPr(6, { isClosed: true }),
      createPr(7, { isClosed: true, isMerged: false }),
      createPr(8, { headRef: undefined }, 11),
    ];
    for (const pr of prs) await stores.prs.insertOne(pr);
  });

  afterAll(async () => {
    await stores.dispose();
  });

  it("matches the documents of the repository still missing a field", async () => {
    const found = await stores.prs.findAll(prsMissingBranchFieldsCriteria(10));

    expect(found.map(({ pr }) => pr.number).toSorted()).toEqual([2, 3, 4, 6]);
  });
});
