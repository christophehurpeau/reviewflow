import { NotFoundError } from "liwi-store";
import type { MongoStores, Repository, ReviewflowPr } from "reviewflow-core";
import { prsMissingBranchFieldsCriteria } from "reviewflow-core";
import type { OctokitRestCompat } from "../octokit";

export interface BackfillOctokit {
  rest: OctokitRestCompat;
}

export type BackfillRepositoryStatus =
  | "authFailed"
  | "complete"
  | "incomplete"
  | "noInstallation"
  | "rateLimited"
  | "repositoryGone";

export interface BackfillRepositoryReport {
  repositoryId: number;
  fullName: string;
  status: BackfillRepositoryStatus;
  /** documents still missing a field when the repository was read */
  candidates: number;
  /** documents updated, or that would be in a dry run */
  written: number;
  /** github answers 404 for the pull request while the repository exists: left as is */
  notFoundOnGithub: number;
  /** removed by retention or a repository cleanup while the backfill ran */
  deletedMeanwhile: number;
  /** github unexpected errors, the document is retried on the next run */
  failed: number;
  /** open on one side and closed on the other: not repaired here */
  stateMismatches: number;
  completionRecorded: boolean;
  /** only set when `status` is `rateLimited`, epoch seconds */
  rateLimitResetsAt?: number;
  /** first writes of a dry run */
  samples: { number: number; set: Partial<ReviewflowPr> }[];
}

export interface BackfillPrBranchesOptions {
  mongoStores: MongoStores;
  auth: (installationId: number) => Promise<BackfillOctokit>;
  dryRun: boolean;
  repositoryId?: number;
  log?: (report: BackfillRepositoryReport) => void;
}

/**
 * The installation token shares its hourly quota with the bot's own webhook
 * handlers. Stopping here, instead of running into a 403, also keeps probot's
 * throttling from sleeping up to an hour inside the request.
 */
const rateLimitReserve = 500;
const maxSamples = 5;

interface GithubErrorLike {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, number | string | undefined> };
}

const asGithubError = (error: unknown): GithubErrorLike =>
  typeof error === "object" && error !== null ? error : {};

const isRateLimitError = (error: unknown): boolean => {
  const { status, message, response } = asGithubError(error);
  if (status === 429) return true;
  if (status !== 403) return false;
  const headers = response?.headers;
  return (
    String(headers?.["x-ratelimit-remaining"]) === "0" ||
    headers?.["retry-after"] !== undefined ||
    /rate limit/i.test(message ?? "")
  );
};

const readResetAt = (error: unknown): number | undefined => {
  const reset = Number(
    asGithubError(error).response?.headers?.["x-ratelimit-reset"],
  );
  return Number.isFinite(reset) && reset > 0 ? reset : undefined;
};

/** every installation reached its quota during the run, keyed by installation id */
type RateLimitedInstallations = Map<number, number | undefined>;

interface BackfillRepositoryOptions extends BackfillPrBranchesOptions {
  repository: Repository;
  rateLimited: RateLimitedInstallations;
  octokits: Map<number, Promise<BackfillOctokit>>;
}

const findInstallationId = async (
  { mongoStores }: BackfillPrBranchesOptions,
  repository: Repository,
): Promise<number | undefined> => {
  const account =
    repository.account.type === "Organization"
      ? await mongoStores.orgs.findByKey(repository.account.id)
      : await mongoStores.users.findByKey(repository.account.id);
  return account?.installationId;
};

const computeUpdate = (
  pr: ReviewflowPr,
  data: {
    head: { ref: string; repo: { full_name: string } | null };
    base: { ref: string };
    merged?: boolean;
  },
): Partial<ReviewflowPr> => {
  const set: Partial<ReviewflowPr> = {};
  // only the missing fields: a webhook may have written a fresher value since
  if (pr.headRef === undefined) set.headRef = data.head.ref;
  if (pr.baseRef === undefined) set.baseRef = data.base.ref;
  if (pr.headRepoFullName === undefined) {
    set.headRepoFullName = data.head.repo?.full_name ?? null;
  }
  // `isMerged` is written by `closed` and `reopened` only: an open document never reopened has none
  if (pr.isClosed && pr.isMerged === undefined) {
    set.isMerged = data.merged === true;
  }
  return set;
};

interface RepositoryRun extends BackfillRepositoryOptions {
  octokit: BackfillOctokit;
  installationId: number;
  report: BackfillRepositoryReport;
  isRepositoryReachable: () => Promise<boolean>;
}

type PullGetResult = Awaited<ReturnType<OctokitRestCompat["pulls"]["get"]>>;

const stopOnRateLimit = (
  { rateLimited, installationId, report }: RepositoryRun,
  resetsAt: number | undefined,
): void => {
  rateLimited.set(installationId, resetsAt);
  report.status = "rateLimited";
  report.rateLimitResetsAt = resetsAt;
};

const fetchPull = async (
  run: RepositoryRun,
  pr: ReviewflowPr,
  [owner, repo]: [string, string],
): Promise<PullGetResult | undefined> => {
  const { octokit, report } = run;
  try {
    return await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pr.pr.number,
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      stopOnRateLimit(run, readResetAt(error));
      return undefined;
    }
    const { status } = asGithubError(error);
    if (status === 401 || status === 403) {
      report.status = "authFailed";
    } else if (status === 404) {
      try {
        if (await run.isRepositoryReachable()) report.notFoundOnGithub++;
        else report.status = "repositoryGone";
      } catch {
        report.failed++;
      }
    } else {
      report.failed++;
    }
    return undefined;
  }
};

const writeUpdate = async (
  { mongoStores, dryRun, report }: RepositoryRun,
  pr: ReviewflowPr,
  data: PullGetResult["data"],
): Promise<void> => {
  if ((data.state === "closed") !== pr.isClosed) report.stateMismatches++;

  const set = computeUpdate(pr, data);
  if (Object.keys(set).length === 0) return;

  if (dryRun) {
    if (report.samples.length < maxSamples) {
      report.samples.push({ number: pr.pr.number, set });
    }
    report.written++;
    return;
  }

  try {
    await mongoStores.prs.partialUpdateOne(
      pr,
      { $set: set },
      { touchUpdated: false },
    );
    report.written++;
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
    report.deletedMeanwhile++;
  }
};

const backfillPrs = async (
  run: RepositoryRun,
  prs: ReviewflowPr[],
): Promise<void> => {
  const { report, repository } = run;
  const [owner, repo] = repository.fullName.split("/") as [string, string];

  for (const pr of prs) {
    const response = await fetchPull(run, pr, [owner, repo]);
    if (report.status !== "complete") return;
    if (!response) continue;

    await writeUpdate(run, pr, response.data);

    const remaining = Number(response.headers["x-ratelimit-remaining"]);
    if (Number.isFinite(remaining) && remaining < rateLimitReserve) {
      const reset = Number(response.headers["x-ratelimit-reset"]);
      stopOnRateLimit(run, Number.isFinite(reset) ? reset : undefined);
      return;
    }
  }
};

const authenticate = async (
  { auth, octokits }: BackfillRepositoryOptions,
  installationId: number,
): Promise<BackfillOctokit | undefined> => {
  let pending = octokits.get(installationId);
  if (!pending) {
    pending = auth(installationId);
    octokits.set(installationId, pending);
  }
  try {
    return await pending;
  } catch {
    return undefined;
  }
};

const recordCompletion = async (
  { mongoStores, repository }: BackfillRepositoryOptions,
  hadCandidates: boolean,
): Promise<void> => {
  if (!hadCandidates && repository.prBranchesBackfilledAt !== undefined) return;
  try {
    await mongoStores.repositories.partialUpdateByKey(
      repository._id,
      { $set: { prBranchesBackfilledAt: new Date() } },
      undefined,
      { touchUpdated: false },
    );
  } catch (error) {
    // the repository was removed meanwhile: nothing left to stamp
    if (!(error instanceof NotFoundError)) throw error;
  }
};

const backfillRepository = async (
  options: BackfillRepositoryOptions,
): Promise<BackfillRepositoryReport> => {
  const { mongoStores, dryRun, repository, rateLimited } = options;
  const report: BackfillRepositoryReport = {
    repositoryId: repository._id,
    fullName: repository.fullName,
    status: "complete",
    candidates: 0,
    written: 0,
    notFoundOnGithub: 0,
    deletedMeanwhile: 0,
    failed: 0,
    stateMismatches: 0,
    completionRecorded: false,
    samples: [],
  };

  const prs = await mongoStores.prs.findAll(
    prsMissingBranchFieldsCriteria(repository._id),
  );
  report.candidates = prs.length;

  if (prs.length > 0) {
    const installationId = await findInstallationId(options, repository);
    if (!installationId) {
      report.status = "noInstallation";
      return report;
    }

    if (rateLimited.has(installationId)) {
      report.status = "rateLimited";
      report.rateLimitResetsAt = rateLimited.get(installationId);
      return report;
    }

    const octokit = await authenticate(options, installationId);
    if (!octokit) {
      report.status = "authFailed";
      return report;
    }

    const [owner, repo] = repository.fullName.split("/") as [string, string];
    let repositoryChecked = false;

    // a stale full name or a lost access answers 404 like a missing pull
    // request does: only a repository that answers tells them apart
    const isRepositoryReachable = async (): Promise<boolean> => {
      if (repositoryChecked) return true;
      try {
        await octokit.rest.repos.get({ owner, repo });
        repositoryChecked = true;
        return true;
      } catch (error) {
        if (asGithubError(error).status === 404) return false;
        throw error;
      }
    };

    await backfillPrs(
      { ...options, octokit, installationId, report, isRepositoryReachable },
      prs,
    );

    if (report.status === "complete" && report.failed > 0) {
      report.status = "incomplete";
    }
  }

  if (report.status === "complete") {
    report.completionRecorded = !dryRun;
    if (!dryRun) await recordCompletion(options, prs.length > 0);
  }

  return report;
};

/**
 * Writes `headRef`, `baseRef`, `headRepoFullName` and `isMerged` on the `prs`
 * documents lacking them, one repository at a time, and stamps
 * `repository.prBranchesBackfilledAt` once a repository has none left.
 *
 * Re-running picks up where the previous run stopped: written documents no
 * longer match, and a repository is stamped only when nothing was skipped
 * because of a rate limit, a lost installation or a github error.
 * `dryRun` reads github and mongo and writes nothing, stamp included.
 */
export const backfillPrBranches = async (
  options: BackfillPrBranchesOptions,
): Promise<BackfillRepositoryReport[]> => {
  const { mongoStores, repositoryId, log } = options;

  const repositories =
    repositoryId === undefined
      ? await mongoStores.repositories.findAll({})
      : [await mongoStores.repositories.findByKey(repositoryId)].filter(
          (repository) => repository !== undefined,
        );

  const rateLimited: RateLimitedInstallations = new Map();
  const octokits = new Map<number, Promise<BackfillOctokit>>();
  const reports: BackfillRepositoryReport[] = [];

  for (const repository of repositories) {
    const report = await backfillRepository({
      ...options,
      repository,
      rateLimited,
      octokits,
    });
    log?.(report);
    reports.push(report);
  }

  return reports;
};
