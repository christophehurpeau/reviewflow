import schedule from 'node-schedule';
import type { Probot } from 'probot';
import type { AppContext } from './context/AppContext';
import type { AccountDailyStats, AccountEmbed, AccountType } from './mongo';
import type { Octokit } from './octokit';

async function dailyStatForOrg(
  day: string,
  appContext: AppContext,
  account: AccountEmbed,
  octokit: Octokit,
): Promise<void> {
  const createDailyStatsEmpty = (): AccountDailyStats['stats'] => ({
    openedPRs: {
      total: 0,
      draft: 0,
      hasRequestedReviewers: 0,
    },
    createdPRs: {
      total: 0,
    },
    closedPRs: {
      total: 0,
      merged: 0,
    },
  });

  const dayDate = new Date(
    Date.UTC(
      // @ts-expect-error -- tuple
      ...(day.split('-') as [string, string, string]).map((part, index) =>
        index === 1 ? Number(part) - 1 : Number(part),
      ),
    ),
  );
  const nextDayDate = new Date(dayDate);
  nextDayDate.setDate(dayDate.getDate() + 1);

  const isOnThatDay = (date: string): boolean => {
    const time = new Date(date).getTime();
    return time >= dayDate.getTime() && time < nextDayDate.getTime();
  };

  const accountStats: AccountDailyStats['stats'] = createDailyStatsEmpty();

  const statsPerRepositoryMap = new Map<
    AccountDailyStats['statsPerRepository'][number]['repo']['id'],
    AccountDailyStats['statsPerRepository'][number]
  >();

  const statsPerMemberMap = new Map<
    AccountDailyStats['statsPerMember'][number]['user']['id'],
    AccountDailyStats['statsPerMember'][number]
  >();

  // for each repository
  for await (const repoResult of octokit.paginate.iterator(
    octokit.repos.listForOrg,
    {
      org: account.login,
      per_page: 100,
    },
  )) {
    for (const repo of repoResult.data) {
      const statsPerRepository: AccountDailyStats['statsPerRepository'][number] =
        {
          repo: {
            id: repo.id,
            name: repo.name,
          },
          ...createDailyStatsEmpty(),
        };
      statsPerRepositoryMap.set(repo.id, statsPerRepository);

      // for each opened pull requests
      for await (const openedPrResult of octokit.paginate.iterator(
        octokit.pulls.list,
        {
          owner: account.login,
          repo: repo.name,
        },
      )) {
        for (const openedPr of openedPrResult.data) {
          const hasRequestedReviewers =
            (openedPr.requested_reviewers &&
              openedPr.requested_reviewers.length > 1) ||
            (openedPr.requested_teams && openedPr.requested_teams.length > 1);
          const authors = openedPr.assignees || [openedPr.user];
          const createdOnThatDay = isOnThatDay(openedPr.created_at);

          [
            accountStats,
            statsPerRepository,
            ...authors.map((author) => {
              if (!author) return null;
              let statsPerMember = statsPerMemberMap.get(author.id);
              if (!statsPerMember) {
                statsPerMember = {
                  user: {
                    id: author.id,
                    login: author.login,
                    type: author.type as AccountType,
                  },
                  ...createDailyStatsEmpty(),
                };
                statsPerMemberMap.set(author.id, statsPerMember);
              }
              return statsPerMember;
            }),
          ].forEach((statsToFufill) => {
            if (!statsToFufill) return;

            statsToFufill.openedPRs.total += 1;
            if (openedPr.draft) statsToFufill.openedPRs.draft += 1;
            if (hasRequestedReviewers) {
              statsToFufill.openedPRs.hasRequestedReviewers += 1;
            }
            if (createdOnThatDay) {
              statsToFufill.createdPRs.total += 1;
            }
          });
        }
      }

      // for each closed pull requests, sorted by updated_at
      for await (const closedPrResult of octokit.paginate.iterator(
        octokit.pulls.list,
        {
          owner: account.login,
          repo: repo.name,
        },
      )) {
        for (const closedPr of closedPrResult.data) {
          if (!(closedPr.closed_at && isOnThatDay(closedPr.closed_at))) return;
          const authors = closedPr.assignees || [closedPr.user];

          [
            accountStats,
            statsPerRepository,
            ...authors.map((author) => {
              if (!author) return null;
              let statsPerMember = statsPerMemberMap.get(author.id);
              if (!statsPerMember) {
                statsPerMember = {
                  user: {
                    id: author.id,
                    login: author.login,
                    type: author.type as AccountType,
                  },
                  ...createDailyStatsEmpty(),
                };
                statsPerMemberMap.set(author.id, statsPerMember);
              }
              return statsPerMember;
            }),
          ].forEach((statsToFufill) => {
            if (!statsToFufill) return;

            statsToFufill.closedPRs.total += 1;
            if (closedPr.merged_at) statsToFufill.closedPRs.merged += 1;
          });
        }
      }
    }
  }

  await appContext.mongoStores.accountDailyStats.insertOne({
    day,
    account,
    stats: accountStats,
    statsPerRepository: [...statsPerRepositoryMap.values()],
    statsPerMember: [...statsPerMemberMap.values()],
  });
}

async function dailyStats(
  appContext: AppContext,
  auth: (installationId: number) => Promise<Octokit>,
): Promise<void> {
  const date = new Date();
  date.setDate(date.getDate() - 1);

  const day = `${date.getUTCFullYear()}-${
    date.getUTCMonth() + 1
  }-${date.getUTCDate()}`;

  for await (const org of await appContext.mongoStores.orgs.cursor()) {
    if (!org.installationId) return;

    const account: AccountEmbed = {
      id: org._id,
      login: org.login,
      type: 'Organization',
    };

    const octokit = await auth(org.installationId);
    await dailyStatForOrg(day, appContext, account, octokit);
  }
}

export default function initScheduler(
  app: Probot,
  appContext: AppContext,
): void {
  // every day at 4 AM
  schedule.scheduleJob('0 0 4 * * *', async () => {
    await appContext.mongoStores.dailyClean();
    await dailyStats(appContext, (installationId) => app.auth(installationId));
  });
}
