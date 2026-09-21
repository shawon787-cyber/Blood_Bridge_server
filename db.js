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

module.exports = {
  client,
  ObjectId,
  users: database.collection("user"),
  donationRequests: database.collection("donation_requests"),
  funding: database.collection("funding"),
};
