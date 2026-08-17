const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId, } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_DB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const database = client.db("blood_bridge");
const donationRequests = database.collection("donation_requests");
const users = database.collection("user");

app.get("/", (req, res) => {
  res.send("Hello World");
});
app.get("/api/donors", async (req, res) => {
  try {
    const donors = await users
      .find(
        { role: "donor" },
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
            bloodGroup: 1,
            district: 1,
            districtId: 1,
            districtName: 1,
            districtBnName: 1,
            upazila: 1,
            upazilaId: 1,
            upazilaName: 1,
            role: 1,
            status: 1
          }
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: donors
    });
  } catch (error) {
    console.error("Failed to fetch donors:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch donors"
    });
  }
});

app.post("/api/donation-requests", async (req, res) => {
  try {
    const donationRequest = req.body;

    const result = await donationRequests.insertOne(donationRequest);

    res.status(201).send({
      success: true,
      message: "Donation request created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Failed to create donation request:", error);

    res.status(500).send({
      success: false,
      message: "Failed to create donation request",
    });
  }
});
app.get("/api/donation-requests", async (req, res) => {
  try {
    const result = await donationRequests
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Failed to fetch donation requests:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch donation requests",
    });
  }
});
app.get("/api/donation-requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid donation request ID",
      });
    }

    const request = await donationRequests.findOne({
      _id: new ObjectId(id),
    });

    // Request not found
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Donation request not found",
      });
    }

    // Successfully found
    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Failed to fetch donation request:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch donation request",
    });
  }
});

async function run() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
}

run();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});