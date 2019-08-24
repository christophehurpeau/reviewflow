// import { MongoStore, MongoConnection, MongoModel } from 'liwi-mongo';
import { MongoConnection } from 'liwi-mongo';

// export interface PrEventsModel extends MongoModel {
//   owner: string;
//   repo: string;
//   prId: string;
//   prNumber: string;
//   event: string;
// }

export interface MongoStores {
  connection: MongoConnection;
  // prEvents: MongoStore<PrEventsModel>;
}

if (!process.env.MONGO_DB) {
  throw new Error('MONGO_DB is missing in process.env');
}

export default function init(): MongoStores {
  const connection = new MongoConnection(
    new Map([
      ['host', process.env.MONGO_HOST || 'localhost'],
      ['port', process.env.MONGO_PORT || '27017'],
      ['database', process.env.MONGO_DB as string],
    ]),
  );

  // const prEvents = new MongoStore<PrEventsModel>(connection, 'prEvents');
  // prEvents.collection.then((coll) => {
  //   coll.createIndex({ owner: 1, repo: 1, ???: 1 });
  // });

  // return { connection, prEvents };
  return { connection };
}
