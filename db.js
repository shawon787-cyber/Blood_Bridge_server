const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const database = client.db("blood_bridge");

let dbInitialized = false;
let dbConnectionPromise = null;

async function initializeDatabase() {
  if (dbInitialized) {
    return;
  }

  if (!dbConnectionPromise) {
    dbConnectionPromise = (async () => {
      await client.connect();
      await client.db("admin").command({ ping: 1 });

      await database.collection("funding").createIndex(
        { stripeSessionId: 1 },
        {
          unique: true,
          sparse: true,
          name: "funding_stripe_session_id_unique",
        }
      );

      dbInitialized = true;
    })().catch((error) => {
      dbConnectionPromise = null;
      throw error;
    });
  }

  await dbConnectionPromise;
}

module.exports = {
  client,
  ObjectId,
  initializeDatabase,
  users: database.collection("user"),
  donationRequests: database.collection("donation_requests"),
  funding: database.collection("funding"),
};
