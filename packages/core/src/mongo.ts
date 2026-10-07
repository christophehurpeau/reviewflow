import type { MongoBaseModel } from "liwi-mongo";
import {
  MongoConnection,
  MongoStore,
  createMongoSubscribeStore,
} from "liwi-mongo";
import type { MessageCategory } from "reviewflow-modules";
import type { AccountInfo } from "./models/AccountInfo.ts";
import type { BasicUser } from "./models/BasicUser.ts";
import type { ChecksAndStatuses } from "./models/ChecksAndStatuses.ts";
import type { RepositorySettings } from "./models/RepositorySettings.ts";
import type { ReviewersGroupedByState } from "./models/ReviewersGroupedByState.ts";
import type { ReviewflowStatus } from "./models/ReviewflowStatus.ts";
import type { SlackMessage } from "./models/SlackMessage.ts";

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
  // id: number;
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
  status: "active" | "deleted" | "suspended";
}

export interface Repository extends MongoBaseModel<number> {
  account: AccountEmbed;
  fullName: string;
  emoji: string;
  settings: RepositorySettings;
  /** archived on github: kept, without its pull requests */
  archived?: boolean;
}

interface RepoEmbed {
  id: Repository["_id"];
  name: Repository["fullName"];
}

export interface Label extends MongoBaseModel<number> {
  account: AccountEmbed;
  repo: RepoEmbed;
  name: string;
  color: string;
  description?: string | null;
}

export interface LabelEmbed {
  id: Label["_id"];
  name: Label["name"];
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
  labels?: LabelEmbed[];
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

/**
 * Store the webapp subscribes to: writes going through it notify the liwi
 * resources subscriptions, so a screen updates without a refetch.
 */
type MongoSubscribeStore<Model extends MongoBaseModel<any>> = ReturnType<
  typeof createMongoSubscribeStore<Model>
>;

export interface MongoStores {
  connection: MongoConnection;
  userDmSettings: MongoSubscribeStore<UserDmSettings>;
  users: MongoSubscribeStore<User>;
  orgs: MongoSubscribeStore<Org>;
  orgMembers: MongoSubscribeStore<OrgMember>;
  repositories: MongoSubscribeStore<Repository>;
  labels: MongoStore<Label>;
  orgTeams: MongoStore<OrgTeam>;
  slackTeams: MongoStore<SlackTeam>;
  slackTeamInstallations: MongoStore<SlackTeamInstallation>;
  slackSentMessages: MongoStore<SlackSentMessage>;
  prs: MongoSubscribeStore<ReviewflowPr>;
  installationsEvents: MongoStore<InstallationEvent>;
  // prEvents: MongoStore<PrEventsModel>;
}

export interface InitializedMongoStores extends MongoStores {
  /**
   * Settles once every index is created and every startup cleanup has run;
   * rejects on the first failure. The stores are usable before then.
   */
  ready: Promise<void>;
}

function isNamespaceNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "codeName" in error &&
    error.codeName === "NamespaceNotFound"
  );
}

export default function init(): InitializedMongoStores {
  if (!process.env.MONGO_DB) {
    throw new Error("MONGO_DB is missing in process.env");
  }

  const connection = new MongoConnection({
    host: process.env.MONGO_HOST || "localhost",
    port: process.env.MONGO_PORT || "27017",
    database: process.env.MONGO_DB,
    user: process.env.MONGO_USER,
    password: process.env.MONGO_USER ? process.env.MONGO_PASSWORD : undefined,
  });

  // const prEvents = new MongoStore<PrEventsModel>(connection, 'prEvents');
  // prEvents.collection.then((coll) => {
  //   coll.createIndex({ owner: 1, repo: 1, ???: 1 });
  // });

  const userDmSettings = new MongoStore<UserDmSettings>(
    connection,
    "userDmSettings",
  );
  const userDmSettingsReady = userDmSettings.collection.then(async (coll) => {
    await coll.createIndex({ userId: 1, orgId: 1 }, { unique: true });
  });

  const users = new MongoStore<User>(connection, "users");
  const usersReady = users.collection.then(async (coll) => {
    await coll.createIndex({ login: 1 }, { unique: true });
  });

  const orgs = new MongoStore<Org>(connection, "orgs");
  const orgsReady = orgs.collection.then(async (coll) => {
    await coll.createIndex({ login: 1 }, { unique: true });
    await coll.createIndex(
      { installationId: 1 },
      { unique: true, sparse: true },
    );
  });

  const orgMembers = new MongoStore<OrgMember>(connection, "orgMembers");
  const orgMembersReady = orgMembers.collection.then(async (coll) => {
    await coll.createIndex({ "user.id": 1, "org.id": 1 }, { unique: true });
    await coll.createIndex(
      { "org.id": 1, "user.id": 1, "teams.id": 1 },
      { unique: true },
    );
    await coll.createIndex({ "org.id": 1, "teams.id": 1 });
  });

  const orgTeams = new MongoStore<OrgTeam>(connection, "orgTeams");
  const orgTeamsReady = orgTeams.collection.then(async (coll) => {
    await coll.createIndex({ "org.id": 1 });
  });

  const slackSentMessages = new MongoStore<SlackSentMessage>(
    connection,
    "slackSentMessages",
  );
  const slackSentMessagesReady = slackSentMessages.collection.then(
    async (coll) => {
      const legacyIndexName = "account.id_1_account.type_1_type_1_typeId_1";
      // `indexExists` rejects when the collection does not exist yet (fresh
      // database), and there is no legacy index to drop then
      const hasLegacyIndex = await coll
        .indexExists(legacyIndexName)
        .catch((error: unknown) => {
          if (isNamespaceNotFound(error)) return false;
          throw error;
        });
      if (hasLegacyIndex) await coll.dropIndex(legacyIndexName);
      await coll.createIndex({
        "account.id": 1,
        "account.type": 1,
        type: 1,
        typeId: 1,
        messageId: 1,
      });
      // remove older than 14 days
      await coll.deleteMany({
        created: { $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      });
    },
  );

  const prs = new MongoStore<ReviewflowPr>(connection, "prs");
  const prsReady = prs.collection.then(async (coll) => {
    await coll.createIndex(
      {
        "account.id": 1,
        "repo.id": 1,
        "pr.number": 1,
      },
      { unique: true },
    );
    await coll.createIndex({
      "account.id": 1,
      "repo.id": 1,
      headSha: 1,
    });
    // one index per branch of the owned-buckets `$or`, see below
    await coll.createIndex({
      "account.id": 1,
      "assignees.id": 1,
    });
    await coll.createIndex({
      "account.id": 1,
      "creator.id": 1,
    });
    // one index per branch of the review-request `$or`: both paths are arrays,
    // so a compound index over the two would be a parallel-array index, and
    // mongo only unions index scans when every branch has one of its own
    await coll.createIndex({
      "account.id": 1,
      "reviews.reviewRequested.id": 1,
    });
    await coll.createIndex({
      "account.id": 1,
      "reviews.teamReviewRequested.id": 1,
    });
    // remove with no activity for 12 * 30 days
    await coll.deleteMany({
      updated: { $lt: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) },
    });
  });

  const slackTeams = new MongoStore<SlackTeam>(connection, "slackTeams");
  const slackTeamInstallations = new MongoStore<SlackTeamInstallation>(
    connection,
    "slackTeamsInstallations",
  );
  const repositories = new MongoStore<Repository>(connection, "repositories");
  const repositoriesReady = repositories.collection.then(async (coll) => {
    await coll.createIndex({
      "account.id": 1,
    });
  });

  const labels = new MongoStore<Label>(connection, "labels");
  const labelsReady = labels.collection.then(async (coll) => {
    await coll.createIndex({ "repo.id": 1 });
    await coll.createIndex({ "account.id": 1 });
  });

  const installationsEvents = new MongoStore<InstallationEvent>(
    connection,
    "installationsEvents",
  );
  const installationsEventsReady = installationsEvents.collection.then(
    async (coll) => {
      await coll.createIndex({ installationId: 1 });
      await coll.createIndex({ "account.login": 1 });
    },
  );

  const ready = Promise.all([
    userDmSettingsReady,
    usersReady,
    orgsReady,
    orgMembersReady,
    orgTeamsReady,
    slackSentMessagesReady,
    prsReady,
    repositoriesReady,
    labelsReady,
    installationsEventsReady,
  ]).then(() => undefined);

  // return { connection, prEvents };
  return {
    ready,
    connection,
    userDmSettings: createMongoSubscribeStore(userDmSettings),
    users: createMongoSubscribeStore(users),
    orgs: createMongoSubscribeStore(orgs),
    orgMembers: createMongoSubscribeStore(orgMembers),
    orgTeams,
    slackTeams,
    slackTeamInstallations,
    slackSentMessages,
    repositories: createMongoSubscribeStore(repositories),
    labels,
    prs: createMongoSubscribeStore(prs),
    installationsEvents,
  };
}
