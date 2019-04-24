import { MongoConnection, MongoStore } from 'liwi-mongo';

const config = new Map([
  ['host', process.env.MONGO_HOST || 'localhost'],
  ['port', process.env.MONGO_PORT || ],
  ['database', process.env.MONGO_DATABASE],
  ['user', process.env.MONGO_USER],
  ['password', process.env.MONGO_PASSWORD],
]);
const connection = new MongoConnection(config);

const createMongoStore = (resourceName: string) =>
  new MongoStore(connection, resourceName);
