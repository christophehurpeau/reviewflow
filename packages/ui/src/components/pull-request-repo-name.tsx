import { Text, View } from "alouette";
import type { ReactNode } from "react";
import { createContext, use } from "react";

/**
 * How an app links a repository's name to its own screen of it, the router
 * being the app's; null keeps the name as plain text, e.g. for a repository
 * the app has no screen of.
 */
export type RenderRepoLink = (ownerRepo: string) => ReactNode;

export const RepoLinkContext = createContext<RenderRepoLink | null>(null);

export interface RepoNameProps {
  ownerRepo: string;
}

/** The repository above a pull request's title, a link when the app gives one. */
export function RepoName({ ownerRepo }: RepoNameProps): ReactNode {
  const renderRepoLink = use(RepoLinkContext);
  const link = renderRepoLink?.(ownerRepo) ?? null;
  if (link === null) {
    return <Text className="text-sm text-muted">{ownerRepo}</Text>;
  }
  // a link stretches in a column: the row keeps it as wide as its name
  return <View className="flex-row">{link}</View>;
}
