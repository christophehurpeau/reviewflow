import { describe, expect, it } from "vitest";
import { filterReposByOwner, listRepoOwners } from "./repoOwners.ts";

const repos = [
  { ownerRepo: "globex/web" },
  { ownerRepo: "acme/api" },
  { ownerRepo: "acme/web" },
];

describe("listRepoOwners", () => {
  it("lists each owner once, sorted", () => {
    expect(listRepoOwners(repos)).toEqual(["acme", "globex"]);
  });
});

describe("filterReposByOwner", () => {
  it("keeps every repository without an owner", () => {
    expect(filterReposByOwner(repos, null)).toBe(repos);
  });

  it("keeps the repositories of that owner", () => {
    expect(filterReposByOwner(repos, "acme")).toEqual([
      { ownerRepo: "acme/api" },
      { ownerRepo: "acme/web" },
    ]);
  });
});
