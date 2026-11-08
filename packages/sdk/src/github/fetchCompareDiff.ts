import type { GitHubTransport } from "./transport.ts";

/**
 * The compare endpoint rather than the pull request's own diff: it takes any
 * range, so a single commit or "since my last review" reads like the whole
 * pull request. Three dots, from the merge base, as a local `git diff` does.
 * GitHub refuses it past 300 files or 20,000 lines.
 */
export const fetchCompareDiff = (
  transport: GitHubTransport,
  { ownerRepo, base, head }: { ownerRepo: string; base: string; head: string },
): Promise<string> => {
  const [owner, name, ...rest] = ownerRepo.split("/");
  if (owner === undefined || name === undefined || rest.length > 0) {
    throw new Error(`${ownerRepo} is not owner/repo`);
  }
  return transport.text({
    path: `repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/compare/${base}...${head}`,
    accept: "application/vnd.github.diff",
  });
};
