import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "intenttext-hub";

let client: MongoClient;
let db: Db;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient>;
}

async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (db) return { client, db };

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(MONGODB_URI);
      global._mongoClientPromise = client.connect();
    }
    client = await global._mongoClientPromise;
  } else {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }

  db = client.db(DB_NAME);
  return { client, db };
}

export default connectToDatabase;
