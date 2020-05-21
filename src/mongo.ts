import { MongoStore, MongoConnection, MongoModel } from 'liwi-mongo';
import { MessageCategory } from './dm/MessageCategory';

// export interface PrEventsModel extends MongoModel {
//   owner: string;
//   repo: string;
//   prId: string;
//   prNumber: string;
//   event: string;
// }

export interface UserDmSettings extends MongoModel {
  userId: number;
  orgId: number;
  settings: Record<MessageCategory, boolean>;
}

// TODO _id is number
export interface User extends MongoModel {
  login: string;
  type: string;
}

// TODO _id is number
export interface Org extends MongoModel {
  login: string;
  installationId?: number;
  slackToken?: string;
}

export interface OrgMember extends MongoModel {
  org: { id: number; login: string };
  user: { id: number; login: string };
  slack?: { id: string };
}

export interface OrgTeam extends MongoModel {
  org: { id: number; login: string };
  name: string;
  slug: string;
  description: string;
}

export interface MongoStores {
  connection: MongoConnection;
  userDmSettings: MongoStore<UserDmSettings>;
  users: MongoStore<User>;
  orgs: MongoStore<Org>;
  orgMembers: MongoStore<OrgMember>;
  orgTeams: MongoStore<OrgTeam>;
  // prEvents: MongoStore<PrEventsModel>;
}

if (!process.env.MONGO_DB) {
  throw new Error('MONGO_DB is missing in process.env');
}

export default function init(): MongoStores {
  const config = new Map([
    ['host', process.env.MONGO_HOST || 'localhost'],
    ['port', process.env.MONGO_PORT || '27017'],
    ['database', process.env.MONGO_DB as string],
  ]);
  if (process.env.MONGO_USER) {
    config.set('user', process.env.MONGO_USER);
    config.set('password', process.env.MONGO_PASSWORD as string);
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
  });

  const orgTeams = new MongoStore<OrgTeam>(connection, 'orgTeams');
  orgTeams.collection.then((coll) => {
    coll.createIndex({ 'org.id': 1 });
  });

  // return { connection, prEvents };
  return { connection, userDmSettings, users, orgs, orgMembers, orgTeams };
}
