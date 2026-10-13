import type { MongoStores, ReviewflowPr } from "reviewflow-core";
import {
  accountConfigs,
  createToPrDetail,
  defaultConfig,
  shouldIgnoreRepo,
} from "reviewflow-core";
import type { PrDetail } from "reviewflow-modules";
import { ApiError } from "./apiErrors.ts";
import type { ApiAuth } from "./authenticatePersonalToken.ts";
import type { ResolvedRepository } from "./resolveRepository.ts";
import { resolveRepository } from "./resolveRepository.ts";

export const maxLookupTargets = 200;

export interface LookupTarget {
  ownerRepo: string;
  headRef: string;
}

export type LookupResult =
  | { found: false; reason: "forbidden" | "noPr" | "notTracked" }
  | { found: true; pr: PrDetail };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** the body is untrusted: every shape the handler relies on is checked here */
export const parseLookupTargets = (body: unknown): LookupTarget[] => {
  if (!isRecord(body) || !Array.isArray(body.targets)) {
    throw new ApiError("badRequest", "`targets` must be an array");
  }
  const targets: unknown[] = body.targets;
  if (targets.length > maxLookupTargets) {
    throw new ApiError(
      "badRequest",
      `\`targets\` holds at most ${maxLookupTargets} entries`,
    );
  }

  return targets.map((target, index): LookupTarget => {
    if (
      !isRecord(target) ||
      typeof target.ownerRepo !== "string" ||
      typeof target.headRef !== "string"
    ) {
      throw new ApiError(
        "badRequest",
        `\`targets[${index}]\` must be { ownerRepo: string, headRef: string }`,
      );
    }
    return { ownerRepo: target.ownerRepo, headRef: target.headRef };
  });
};

const notFound = (
  reason: "forbidden" | "noPr" | "notTracked",
): LookupResult => ({ found: false, reason });

/**
 * Newest = highest pull request number: numbers only grow in a repository,
 * whereas dates can be missing on old documents.
 */
const newest = (prs: ReviewflowPr[]): ReviewflowPr | undefined => {
  let best: ReviewflowPr | undefined;
  for (const pr of prs) {
    if (!best || pr.pr.number > best.pr.number) best = pr;
  }
  return best;
};

/**
 * Pull requests of `ownerRepo` whose head branch is `headRef`, in the same
 * order as `targets`. Everything shared between targets (access to the owner,
 * the repository, whether it is tracked) is resolved once per distinct
 * `ownerRepo`, and one failing target never hides the others.
 */
export const lookupPrs = async (
  mongoStores: MongoStores,
  auth: ApiAuth,
  targets: LookupTarget[],
): Promise<LookupResult[]> => {
  type RepositoryLookup =
    | {
        kind: "tracked";
        resolved: Extract<ResolvedRepository, { status: "ok" }>;
        /** repository documents without `headRef`: `noPr` cannot be trusted */
        incomplete: () => Promise<boolean>;
      }
    | { kind: "result"; result: LookupResult };

  const lookupRepository = async (
    ownerRepo: string,
  ): Promise<RepositoryLookup> => {
    const slash = ownerRepo.indexOf("/");
    const owner = slash === -1 ? ownerRepo : ownerRepo.slice(0, slash);
    const repoName = slash === -1 ? "" : ownerRepo.slice(slash + 1);

    const resolved = await resolveRepository(
      mongoStores,
      auth,
      owner,
      repoName,
    );
    if (resolved.status === "forbidden") {
      return { kind: "result", result: notFound("forbidden") };
    }
    if (resolved.status === "unknownRepository") {
      return { kind: "result", result: notFound("notTracked") };
    }

    const { account, repository } = resolved;
    const store = account.type === "Organization" ? "orgs" : "users";
    const accountDoc = await mongoStores[store].findByKey(account.id);
    if (!accountDoc?.installationId) {
      return { kind: "result", result: notFound("notTracked") };
    }

    // same rule as the bot, on the repository name alone
    const config = accountConfigs[account.login] || defaultConfig;
    if (
      shouldIgnoreRepo(
        repository.fullName.slice(repository.fullName.indexOf("/") + 1),
        config,
      )
    ) {
      return { kind: "result", result: notFound("notTracked") };
    }

    // lazy: only a target without a match needs it, and a rejection nobody
    // awaits must not go unhandled
    let incomplete: Promise<boolean> | undefined;
    return {
      kind: "tracked",
      resolved,
      incomplete: () => {
        incomplete ??= mongoStores.prs
          .findOne({
            "account.id": account.id,
            "repo.id": repository._id,
            headRef: { $exists: false },
          })
          .then(Boolean);
        return incomplete;
      },
    };
  };

  const repositories = new Map<string, Promise<RepositoryLookup>>();
  const lookups = new Map<string, Promise<LookupResult>>();
  const toPrDetails = new Map<number, ReturnType<typeof createToPrDetail>>();

  const lookupTarget = async ({
    ownerRepo,
    headRef,
  }: LookupTarget): Promise<LookupResult> => {
    const repoKey = ownerRepo.toLowerCase();
    let repositoryLookup = repositories.get(repoKey);
    if (!repositoryLookup) {
      repositoryLookup = lookupRepository(ownerRepo);
      repositories.set(repoKey, repositoryLookup);
    }
    const lookup = await repositoryLookup;
    if (lookup.kind === "result") return lookup.result;

    const { account, repository } = lookup.resolved;
    const prs = await mongoStores.prs.findAll({
      "account.id": account.id,
      "repo.id": repository._id,
      headRef,
    });
    // a fork can push a branch with the same name: only the repository's own
    // head branch counts, `null` (head repository deleted) never matches
    const ownBranch = prs.filter(
      (pr) =>
        pr.headRepoFullName?.toLowerCase() ===
        repository.fullName.toLowerCase(),
    );
    const pr = newest(ownBranch);

    if (!pr) {
      return notFound((await lookup.incomplete()) ? "notTracked" : "noPr");
    }

    let toPrDetail = toPrDetails.get(account.id);
    if (!toPrDetail) {
      toPrDetail = createToPrDetail({
        userId: auth.user.id,
        accounts: [{ accountId: account.id, teams: account.teams }],
      });
      toPrDetails.set(account.id, toPrDetail);
    }
    return { found: true, pr: toPrDetail(pr) };
  };

  return Promise.all(
    targets.map((target) => {
      const key = `${target.ownerRepo.toLowerCase()}\n${target.headRef}`;
      let lookup = lookups.get(key);
      if (!lookup) {
        lookup = lookupTarget(target);
        lookups.set(key, lookup);
      }
      return lookup;
    }),
  );
};
