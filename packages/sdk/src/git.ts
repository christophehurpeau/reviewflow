/**
 * Node-only surface: reads a pull request diff from a local git checkout.
 * Import it as `@reviewflow/sdk/git`; the root entry stays browser-safe.
 */
export { git, gitFailedCode, gitOrNull, reasonLine } from "./git/run.ts";
export type { GitOptions } from "./git/run.ts";
export {
  defaultDiffLimits,
  parseNumstat,
  readBranchDiff,
} from "./git/readBranchDiff.ts";
export type { BranchDiffScope } from "./diff/types.ts";
export type {
  BranchDiff,
  DiffLimits,
  NumstatEntry,
} from "./git/readBranchDiff.ts";
export {
  readCheckoutBranchDiff,
  readDefaultBranch,
  readHeadBranch,
  readHeadSha,
  resolveDiffBase,
} from "./git/checkoutBranchDiff.ts";
export type {
  CheckoutBranchDiffParams,
  ResolvedDiffBase,
} from "./git/checkoutBranchDiff.ts";
export {
  defaultRecentCommits,
  readCommitDiff,
  readRecentCommits,
} from "./git/checkoutCommits.ts";
export type {
  CommitDiffParams,
  RecentCommitsParams,
} from "./git/checkoutCommits.ts";
export {
  parseStatusV2,
  pullCheckout,
  pushCheckout,
  readCheckoutStatus,
  readCheckoutSync,
} from "./git/checkoutSync.ts";
export type {
  CheckoutFetch,
  ReadCheckoutSyncParams,
  StatusV2,
} from "./git/checkoutSync.ts";
export {
  groupDiffPaths,
  noPackages,
  packagesAtTree,
  packagesOnDisk,
} from "./git/groupDiffPaths.ts";
export type { IsPackage } from "./git/groupDiffPaths.ts";
export { readFileAtSha, readPullRequestDiff } from "./git/pullRequestDiff.ts";
export type { PullRequestDiffRequest } from "./git/pullRequestDiff.ts";
export { readReadingOrder } from "./git/readingOrder.ts";
export type { ReadingOrderRequest } from "./git/readingOrder.ts";
export {
  createBindingsCache,
  maxTypescriptFiles,
  readImpacts,
} from "./git/readImpacts.ts";
export type {
  BindingsCache,
  ImpactsRequest,
  ModuleSummary,
} from "./git/readImpacts.ts";
