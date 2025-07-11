/* eslint-disable @typescript-eslint/no-floating-promises */
import type { MongoBaseModel } from "liwi-mongo";
import { MongoConnection, MongoStore } from "liwi-mongo";
import type { AccountInfo } from "./context/getOrCreateAccount";
import type { SlackMessage } from "./context/slack/SlackMessage";
import type { MessageCategory } from "./dm/MessageCategory";
import type { ReviewflowStatus } from "./events/pr-handlers/actions/editOpenedPR";
import type { RepositorySettings } from "./events/pr-handlers/actions/utils/body/repositorySettings";
import type { BasicUser } from "./events/pr-handlers/utils/PullRequestData";
import type { ReviewersGroupedByState } from "./events/pr-handlers/utils/groupReviewsWithState";
import type { ChecksAndStatuses } from "./utils/github/pullRequest/checksAndStatuses";

// export interface PrEventsModel extends MongoModel {
//   owner: string;
//   repo: string;
//   prId: string;
//   prNumber: string;
//   event: string;
// }

export type AccountType = "Organization" | "User";

export interface AccountEmbed {
  id: number;
  login: string;
  type: AccountType;
}

interface PrEmbed {
  id: number;
  number: number;
}

export type AccountEmbedWithoutType = Omit<AccountEmbed, "type">;

export interface UserDmSettings extends MongoBaseModel {
  userId: number;
  orgId: number;
  settings: Record<MessageCategory, boolean>;
  silentTeams?: OrgTeamEmbed[];
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

export interface Repository extends MongoBaseModel<number> {
  account: AccountEmbed;
  fullName: string;
  emoji: string;
  settings: RepositorySettings;
}

interface RepoEmbed {
  id: Repository["_id"];
  name: Repository["fullName"];
}

export interface OrgTeam extends MongoBaseModel<number> {
  org: AccountEmbedWithoutType;
  name: string;
  slug: string;
  description: string | null;
}

export interface OrgTeamEmbed {
  id: OrgTeam["_id"];
  name: OrgTeam["name"];
  slug: OrgTeam["slug"];
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
  teamId: SlackTeam["_id"];
}

export type SlackMessageType =
  | "commit-comment"
  | "issue-comment"
  | "pr-checksAndStatuses"
  | "review-comment"
  | "review-requested"
  | "review-submitted";

export interface SlackSentMessage extends MongoBaseModel {
  type: SlackMessageType;
  typeId: number | string;
  /** optional message id to create unique message with type + typeId + messageId */
  messageId?: number | string;
  account: AccountEmbed;
  message: SlackMessage;
  reactions?: string[];
  isMarkedAsDone?: boolean;
  sentTo: {
    user: AccountInfo;
    channel: string;
    ts: string;
  }[];
}

interface ReviewflowPrChangesInformation {
  changedFiles: number;
  additions: number;
  deletions: number;
}

export interface ReviewflowPr extends MongoBaseModel {
  account: AccountEmbed;
  repo: RepoEmbed;
  pr: PrEmbed;
  commentId: number;
  headSha?: string;
  title: string;
  isDraft: boolean;
  isClosed: boolean;
  changesInformation?: ReviewflowPrChangesInformation;
  lastLintStatusesCommit?: string;
  lintStatuses?: ReviewflowStatus[];
  lastFlowStatusCommit?: string;
  flowStatus?: ReviewflowStatus["status"];
  automergeStatus?: ReviewflowStatus["status"];
  checksConclusion?: ChecksAndStatuses["checksConclusionRecord"];
  statusesConclusion?: ChecksAndStatuses["statusesConclusionRecord"];
  reviews: ReviewersGroupedByState;
  creator?: BasicUser;
  assignees: BasicUser[];
  flowDates?: {
    createdAt: Date;
    openedAt: Date;
    readyAt?: Date;
    reviewStartedAt?: Date;
    approvedAt?: Date;
    closedAt?: Date;
  };
  // flowHistory: FlowHistory[];
}

export interface InstallationEvent extends MongoBaseModel {
  installationId: number;
  account: AccountEmbed;
  sender: AccountEmbed;
  action: string;
  data: any;
}

export interface MongoStores {
  connection: MongoConnection;
  userDmSettings: MongoStore<UserDmSettings>;
  users: MongoStore<User>;
  orgs: MongoStore<Org>;
  orgMembers: MongoStore<OrgMember>;
  repositories: MongoStore<Repository>;
  orgTeams: MongoStore<OrgTeam>;
  slackTeams: MongoStore<SlackTeam>;
  slackTeamInstallations: MongoStore<SlackTeamInstallation>;
  slackSentMessages: MongoStore<SlackSentMessage>;
  prs: MongoStore<ReviewflowPr>;
  installationsEvents: MongoStore<InstallationEvent>;
  // prEvents: MongoStore<PrEventsModel>;
}

if (!process.env.MONGO_DB) {
  throw new Error("MONGO_DB is missing in process.env");
}

export default function init(): MongoStores {
  const config = new Map([
    ["host", process.env.MONGO_HOST || "localhost"],
    ["port", process.env.MONGO_PORT || "27017"],
    ["database", process.env.MONGO_DB!],
  ]);
  if (process.env.MONGO_USER) {
    config.set("user", process.env.MONGO_USER);
    config.set("password", process.env.MONGO_PASSWORD!);
  }
  const connection = new MongoConnection(config);

  // const prEvents = new MongoStore<PrEventsModel>(connection, 'prEvents');
  // prEvents.collection.then((coll) => {
  //   coll.createIndex({ owner: 1, repo: 1, ???: 1 });
  // });

  const userDmSettings = new MongoStore<UserDmSettings>(
    connection,
    "userDmSettings",
  );
  userDmSettings.collection.then((coll) => {
    coll.createIndex({ userId: 1, orgId: 1 }, { unique: true });
  });

  const users = new MongoStore<User>(connection, "users");
  users.collection.then((coll) => {
    coll.createIndex({ login: 1 }, { unique: true });
  });

  const orgs = new MongoStore<Org>(connection, "orgs");
  orgs.collection.then((coll) => {
    coll.createIndex({ login: 1 }, { unique: true });
  });

  const orgMembers = new MongoStore<OrgMember>(connection, "orgMembers");
  orgMembers.collection.then((coll) => {
    coll.createIndex({ "user.id": 1, "org.id": 1 }, { unique: true });
    coll.createIndex(
      { "org.id": 1, "user.id": 1, "teams.id": 1 },
      { unique: true },
    );
    coll.createIndex({ "org.id": 1, "teams.id": 1 });
  });

  const orgTeams = new MongoStore<OrgTeam>(connection, "orgTeams");
  orgTeams.collection.then((coll) => {
    coll.createIndex({ "org.id": 1 });
  });

  const slackSentMessages = new MongoStore<SlackSentMessage>(
    connection,
    "slackSentMessages",
  );
  slackSentMessages.collection.then((coll) => {
    coll
      .indexExists("account.id_1_account.type_1_type_1_typeId_1")
      .then((exists) => {
        if (exists) {
          coll.dropIndex("account.id_1_account.type_1_type_1_typeId_1");
        }
      });
    coll.createIndex({
      "account.id": 1,
      "account.type": 1,
      type: 1,
      typeId: 1,
      messageId: 1,
    });
    // remove older than 14 days
    coll.deleteMany({
      created: { $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    });
  });

  const prs = new MongoStore<ReviewflowPr>(connection, "prs");
  prs.collection.then((coll) => {
    coll.createIndex(
      {
        "account.id": 1,
        "repo.id": 1,
        "pr.number": 1,
      },
      { unique: true },
    );
    coll.createIndex({
      "account.id": 1,
      "repo.id": 1,
      headSha: 1,
    });
    coll.createIndex({
      "account.id": 1,
      "assignees.id": 1,
    });
    // remove with no activity for 12 * 30 days
    coll.deleteMany({
      updated: { $lt: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) },
    });
  });

  const slackTeams = new MongoStore<SlackTeam>(connection, "slackTeams");
  const slackTeamInstallations = new MongoStore<SlackTeamInstallation>(
    connection,
    "slackTeamsInstallations",
  );
  const repositories = new MongoStore<Repository>(connection, "repositories");
  repositories.collection.then((coll) => {
    coll.createIndex({
      "account.id": 1,
    });
  });

  const installationsEvents = new MongoStore<InstallationEvent>(
    connection,
    "installationsEvents",
  );
  installationsEvents.collection.then((coll) => {
    coll.createIndex({ installationId: 1 });
    coll.createIndex({ "account.login": 1 });
  });

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
    repositories,
    prs,
    installationsEvents,
  };
}
