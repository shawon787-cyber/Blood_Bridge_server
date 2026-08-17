const express = require('express');
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require('mongodb')
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
const PORT = 5000;

const uri = process.env.MONGO_DB_URI

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
app.get('/', (req, res)=>{
    res.send('Hello World');
})

async function run() {
  try {
    await client.connect();

    const database = client.db("blood_bridge");
    const donationRequests = database.collection("donation_requests");

    app.post('/donation-requests', async (req, res) => {
        const donationRequest = req.body;
    })

    await client.db("admin").command({ ping: 1 });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
}

run();


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});