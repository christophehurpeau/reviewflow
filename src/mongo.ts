/* eslint-disable @typescript-eslint/no-floating-promises */
import type { MongoBaseModel } from 'liwi-mongo';
import { MongoStore, MongoConnection } from 'liwi-mongo';
import type { AccountInfo } from './context/getOrCreateAccount';
import type { SlackMessage } from './context/slack/SlackMessage';
import type { MessageCategory } from './dm/MessageCategory';

// export interface PrEventsModel extends MongoModel {
//   owner: string;
//   repo: string;
//   prId: string;
//   prNumber: string;
//   event: string;
// }

export type AccountType = 'Organization' | 'User';

export interface AccountEmbed {
  id: number;
  login: string;
  type: AccountType;
}

interface RepoEmbed {
  id: number;
  name: string;
}

interface PrEmbed {
  number: number;
}

export type AccountEmbedWithoutType = Omit<AccountEmbed, 'type'>;

export interface UserDmSettings extends MongoBaseModel {
  userId: number;
  orgId: number;
  settings: Record<MessageCategory, boolean>;
  silentTeams: OrgTeamEmbed[];
}

interface BaseAccount extends MongoBaseModel<number> {
  login: string;
  installationId?: number;
}

export interface User extends BaseAccount {
  type: string;
}

interface OrgConfig {
  canUseExternalSlack?: boolean;
}

export interface Org extends BaseAccount {
  slackTeamId?: string;
  /** @deprecated */
  slackToken?: string;
  config: OrgConfig;
}

export interface OrgTeam extends MongoBaseModel<number> {
  org: AccountEmbedWithoutType;
  name: string;
  slug: string;
  description: string | null;
}

export interface OrgTeamEmbed {
  id: OrgTeam['_id'];
  name: OrgTeam['name'];
  slug: OrgTeam['slug'];
}

interface OrgMemberSlack {
  id: string;
  email?: string;
  accessToken?: string;
  scope?: string[];
  teamId?: string;
}

export interface OrgMember extends MongoBaseModel {
  org: AccountEmbedWithoutType;
  user: AccountEmbedWithoutType;
  slack?: OrgMemberSlack;
  teams: OrgTeamEmbed[];
}

export interface SlackTeam extends MongoBaseModel {
  /** slack app installed (should be the same everywhere, but could be useful later) */
  appId: string;
  installerUserId: string;
  botUserId: string;
  botAccessToken?: string;
  scope?: string[];
  teamName?: string;
}

export interface SlackTeamInstallation extends SlackTeam {
  teamId: SlackTeam['_id'];
}

export type SlackMessageType =
  | 'issue-comment'
  | 'review-comment'
  | 'review-requested'
  | 'review-submitted';

export interface SlackSentMessage extends MongoBaseModel {
  type: SlackMessageType;
  typeId: number | string;
  account: AccountEmbed;
  message: SlackMessage;
  sentTo: {
    user: AccountInfo;
    channel: string;
    ts: string;
  }[];
}

export interface AutomergeLog extends MongoBaseModel {
  account: AccountEmbed;
  repoFullName: string;
  pr: {
    id: number;
    number: number;
    isRenovate: boolean;
    mergeableState: string;
  };
  type:
    | 'already merged'
    | 'behind mergeable_state'
    | 'blocked mergeable_state'
    | 'failed status or checks'
    | 'not mergeable'
    | 'rebase-renovate'
    | 'unknown mergeable_state';
  action: 'remove' | 'reschedule' | 'update branch' | 'wait';
}

export interface ReviewflowPr extends MongoBaseModel {
  account: AccountEmbed;
  repo: RepoEmbed;
  pr: PrEmbed;
  commentId: number;
}

export interface MongoStores {
  connection: MongoConnection;
  userDmSettings: MongoStore<UserDmSettings>;
  users: MongoStore<User>;
  orgs: MongoStore<Org>;
  orgMembers: MongoStore<OrgMember>;
  orgTeams: MongoStore<OrgTeam>;
  slackTeams: MongoStore<SlackTeam>;
  slackTeamInstallations: MongoStore<SlackTeamInstallation>;
  slackSentMessages: MongoStore<SlackSentMessage>;
  automergeLogs: MongoStore<AutomergeLog>;
  prs: MongoStore<ReviewflowPr>;
  // prEvents: MongoStore<PrEventsModel>;
}

if (!process.env.MONGO_DB) {
  throw new Error('MONGO_DB is missing in process.env');
}

export default function init(): MongoStores {
  const config = new Map([
    ['host', process.env.MONGO_HOST || 'localhost'],
    ['port', process.env.MONGO_PORT || '27017'],
    ['database', process.env.MONGO_DB!],
  ]);
  if (process.env.MONGO_USER) {
    config.set('user', process.env.MONGO_USER);
    config.set('password', process.env.MONGO_PASSWORD!);
  }
  const connection = new MongoConnection(config);

  // const prEvents = new MongoStore<PrEventsModel>(connection, 'prEvents');
  // prEvents.collection.then((coll) => {
  //   coll.createIndex({ owner: 1, repo: 1, ???: 1 });
  // });

  const userDmSettings = new MongoStore<UserDmSettings>(
    connection,
    'userDmSettings',
  );
  userDmSettings.collection.then((coll) => {
    coll.createIndex({ userId: 1, orgId: 1 }, { unique: true });
  });

  const users = new MongoStore<User>(connection, 'users');
  users.collection.then((coll) => {
    coll.createIndex({ login: 1 }, { unique: true });
  });

  const orgs = new MongoStore<Org>(connection, 'orgs');
  orgs.collection.then((coll) => {
    coll.createIndex({ login: 1 }, { unique: true });
  });

  const orgMembers = new MongoStore<OrgMember>(connection, 'orgMembers');
  orgMembers.collection.then((coll) => {
    coll.createIndex({ 'user.id': 1, 'org.id': 1 }, { unique: true });
    coll.createIndex(
      { 'org.id': 1, 'user.id': 1, 'teams.id': 1 },
      { unique: true },
    );
    coll.createIndex({ 'org.id': 1, 'teams.id': 1 });
  });

  const orgTeams = new MongoStore<OrgTeam>(connection, 'orgTeams');
  orgTeams.collection.then((coll) => {
    coll.createIndex({ 'org.id': 1 });
  });

  const slackSentMessages = new MongoStore<SlackSentMessage>(
    connection,
    'slackSentMessages',
  );
  slackSentMessages.collection.then((coll) => {
    coll.createIndex({
      'account.id': 1,
      'account.type': 1,
      type: 1,
      typeId: 1,
    });
    // remove older than 14 days
    coll.deleteMany({
      created: { $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    });
  });

  const automergeLogs = new MongoStore<AutomergeLog>(
    connection,
    'automergeLogs',
  );
  automergeLogs.collection.then((coll) => {
    coll.createIndex({
      repoFullName: 1,
      type: 1,
    });
    coll.createIndex({
      repoFullName: 1,
      'pr.number': 1,
    });
    // remove older than 30 days
    coll.deleteMany({
      created: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
  });

  const prs = new MongoStore<ReviewflowPr>(connection, 'prs');
  prs.collection.then((coll) => {
    coll.createIndex(
      {
        'account.id': 1,
        'repo.id': 1,
        'pr.number': 1,
      },
      { unique: true },
    );
    // remove older than 12 * 30 days
    coll.deleteMany({
      created: { $lt: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) },
    });
  });

  const slackTeams = new MongoStore<SlackTeam>(connection, 'slackTeams');
  const slackTeamInstallations = new MongoStore<SlackTeamInstallation>(
    connection,
    'slackTeamsInstallations',
  );

  // return { connection, prEvents };
  return {
    connection,
    userDmSettings,
    users,
    orgs,
    orgMembers,
    orgTeams,
    slackTeams,
    slackTeamInstallations,
    slackSentMessages,
    automergeLogs,
    prs,
  };
}
