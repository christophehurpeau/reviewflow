import type { Config } from "./accountConfigs/types.ts";

export const shouldIgnoreRepo = (
  repoName: string,
  accountConfig: Config,
): boolean => {
  const ignoreRepoRegexp =
    accountConfig.ignoreRepoPattern &&
    new RegExp(`^${accountConfig.ignoreRepoPattern}$`);

  if (repoName === "reviewflow-test") {
    return process.env.REVIEWFLOW_NAME !== "reviewflow-dev";
  }

  if (ignoreRepoRegexp) {
    return ignoreRepoRegexp.test(repoName);
  }

  return false;
};
