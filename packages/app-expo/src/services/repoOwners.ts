import type { CheckoutRepo } from "@reviewflow/sdk";

type OwnedRepo = Pick<CheckoutRepo, "ownerRepo">;

const ownerOf = ({ ownerRepo }: OwnedRepo): string =>
  ownerRepo.slice(0, ownerRepo.indexOf("/"));

export const listRepoOwners = (repos: OwnedRepo[]): string[] =>
  [...new Set(repos.map(ownerOf))].toSorted((a, b) => a.localeCompare(b));

export const filterReposByOwner = <Repo extends OwnedRepo>(
  repos: Repo[],
  owner: string | null,
): Repo[] =>
  owner === null ? repos : repos.filter((repo) => ownerOf(repo) === owner);
