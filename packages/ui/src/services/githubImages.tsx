import type { PullRequestImageProxies } from "@reviewflow/sdk";
import { createContext, use } from "react";

/**
 * The camo urls of the pull request's bodies, by the url each body wrote:
 * an image is loaded through GitHub's proxy, so its host never learns who
 * read the pull request nor when.
 */
export const GithubImagesContext = createContext<PullRequestImageProxies>({});

const githubHost = /(?:^|\.)(?:github\.com|githubusercontent\.com)$/;

/**
 * Where to load an image from: its camo url, or the image itself when GitHub
 * hosts it (an attachment); null for any other host, whose image is linked
 * rather than loaded.
 */
export const imageSourceOf = (
  src: string,
  proxies: PullRequestImageProxies,
): string | null => {
  const proxied = proxies[src];
  if (proxied !== undefined) return proxied;
  try {
    const { protocol, hostname } = new URL(src);
    return protocol === "https:" && githubHost.test(hostname) ? src : null;
  } catch {
    return null;
  }
};

export const useGithubImages = (): PullRequestImageProxies =>
  use(GithubImagesContext);
