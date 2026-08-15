import type { AccountEmbed, MongoStores, Repository } from "reviewflow-core";
import {
  accountConfigs,
  defaultConfig,
  getEmojiFromRepoDescription,
  shouldIgnoreRepo,
} from "reviewflow-core";
import { deleteRepoContext } from "../../../context/repoContext.ts";
import { syncRepositoryLabels } from "../../../context/syncRepositoryLabels.ts";
import type { OctokitPaginate, OctokitRestCompat } from "../../../octokit";
import type { GraphqlOctokit } from "../../../utils/github/repo/getRepositorySettings.ts";
import { fetchRepositorySettings } from "../../../utils/github/repo/getRepositorySettings.ts";
import { createRepositorySettings } from "../../pr-handlers/actions/utils/body/repositorySettings.ts";
import { deleteRepositoryData } from "../utils/deleteRepositoryData.ts";
import { setRepositoryArchived } from "../utils/setRepositoryArchived.ts";
import { updateRepositoryAccount } from "../utils/updateRepositoryAccount.ts";

export interface SyncRepositoryOctokit extends GraphqlOctokit {
  rest: OctokitRestCompat;
  paginate: OctokitPaginate;
}

export interface SyncRepositoryOptions {
  mongoStores: MongoStores;
  octokit: SyncRepositoryOctokit;
  repository: Repository;
}

export type SyncRepositoryResult = "archived" | "deleted" | "synced";

interface InstallationRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  archived: boolean;
  owner: { id: number; login: string; type: string };
}

/**
 * Brings a repository back in line with github, for the changes no webhook is
 * replaying: the repository being gone — deleted, or taken out of the
 * installation — a rename or a transfer that was missed, and its labels.
 *
 * The installation repositories are the reference rather than a lookup by name:
 * they answer "is this repository still ours" for the id stored, which a 404 on
 * a stale full name cannot.
 */
export const syncRepository = async ({
  mongoStores,
  octokit,
  repository,
}: SyncRepositoryOptions): Promise<SyncRepositoryResult> => {
  const installationRepositories = (await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  )) as InstallationRepository[];

  const githubRepository = installationRepositories.find(
    ({ id }) => id === repository._id,
  );

  if (!githubRepository) {
    await deleteRepositoryData({ mongoStores, repositoryId: repository._id });
    return "deleted";
  }

  const { name, full_name: fullName, description, owner } = githubRepository;
  const account: AccountEmbed = {
    id: owner.id,
    login: owner.login,
    type: owner.type === "Organization" ? "Organization" : "User",
  };

  if (account.id !== repository.account.id) {
    await updateRepositoryAccount({
      mongoStores,
      repositoryId: repository._id,
      repoName: name,
      fullName,
      account,
    });
  }

  // an archived repository is still listed by the installation, and is kept
  // without its pull requests, as the `repository.archived` handler does
  if (githubRepository.archived) {
    await setRepositoryArchived({
      mongoStores,
      repositoryId: repository._id,
      archived: true,
    });
    return "archived";
  }

  const settingsResult = await fetchRepositorySettings(octokit, {
    owner: owner.login,
    repo: name,
  });

  await mongoStores.repositories.partialUpdateByKey(repository._id, {
    $set: {
      account,
      fullName,
      emoji: getEmojiFromRepoDescription(description),
      settings: createRepositorySettings(settingsResult),
      archived: false,
    },
  });

  const config = accountConfigs[owner.login] || defaultConfig;

  if (!shouldIgnoreRepo(name, config)) {
    const labels = await octokit.paginate(
      octokit.rest.issues.listLabelsForRepo,
      { owner: owner.login, repo: name, per_page: 100 },
    );

    await syncRepositoryLabels({
      mongoStores,
      account,
      repo: { id: repository._id, name },
      labels,
    });
  }

  // the settings and labels the sync just rewrote are cached per repo context,
  // and only a new process would pick them up otherwise
  await deleteRepoContext(repository._id);

  return "synced";
};
