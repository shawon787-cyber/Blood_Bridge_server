const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { MongoClient, ServerApiVersion, ObjectId, } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = 5000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});
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
app.get("/api/admin/users", async (req, res) => {
  try {
    const usersData = await users
      .find(
        {},
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
            bloodGroup: 1,
            district: 1,
            upazila: 1,
            role: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    const formattedUsers = usersData.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      image: user.image || "",
      bloodGroup: user.bloodGroup || "N/A",
      location: `${user.upazila || ""}, ${user.district || ""}`,
      role:
        user.role === "donor"
          ? "Donor"
          : user.role === "volunteer"
          ? "Volunteer"
          : user.role === "administrator"
          ? "Administrator"
          : user.role,
      status:
        user.status === "active"
          ? "Active"
          : user.status === "blocked"
          ? "Blocked"
          : user.status,
      joined: user.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});
app.get("/api/user/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await users.findOne({
      _id: new ObjectId(id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Failed to fetch user:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
});
app.patch("/api/users/:id/profile", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const allowedFields = [
      "name",
      "image",
      "phone",
      "bloodGroup",
      "district",
      "districtId",
      "districtName",
      "districtBnName",
      "upazila",
      "upazilaId",
      "upazilaName",
    ];

    const updateData = {
      updatedAt: new Date(),
    };

    allowedFields.forEach((field) => {
      if (
        req.body[field] !== undefined &&
        req.body[field] !== null
      ) {
        updateData[field] = req.body[field];
      }
    });

    // No actual profile field provided
    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const result = await users.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: updateData,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await users.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Failed to update profile:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
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
// ============================================================
// BLOCK USER
// ============================================================

app.patch("/api/admin/users/:id/block", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await users.findOne({
      _id: new ObjectId(id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status === "blocked") {
      return res.status(400).json({
        success: false,
        message: "User is already blocked",
      });
    }

    const result = await users.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          status: "blocked",
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to block user",
      });
    }

    const updatedUser = await users.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "User blocked successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Failed to block user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to block user",
    });
  }
});
// ============================================================
// UNBLOCK USER
// ============================================================

app.patch("/api/admin/users/:id/unblock", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await users.findOne({
      _id: new ObjectId(id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status === "active") {
      return res.status(400).json({
        success: false,
        message: "User is already active",
      });
    }

    const result = await users.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          status: "active",
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to unblock user",
      });
    }

    const updatedUser = await users.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "User unblocked successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Failed to unblock user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to unblock user",
    });
  }
});

// ============================================================
// TOGGLE DONOR / VOLUNTEER ROLE
// ============================================================

app.patch("/api/admin/users/:id/toggle-role", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await users.findOne({
      _id: new ObjectId(id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Only donor <-> volunteer can be switched
    if (user.role !== "donor" && user.role !== "volunteer") {
      return res.status(400).json({
        success: false,
        message: "Only donor and volunteer roles can be switched",
      });
    }

    const newRole = user.role === "donor" ? "volunteer" : "donor";

    const result = await users.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          role: newRole,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to change user role",
      });
    }

    const updatedUser = await users.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: `User role changed from ${user.role} to ${newRole}`,
      data: updatedUser,
    });
  } catch (error) {
    console.error("Failed to toggle user role:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to change user role",
    });
  }
});
// ============================================================
// PROFILE IMAGE UPLOAD API
// ============================================================

app.post(
  "/api/users/:id/profile-image",
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

      // Check user exists
      const user = await users.findOne({
        _id: new ObjectId(id),
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Save image into MongoDB
      const result = await users.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
  profileImage: req.file.buffer,
  profileImageContentType: req.file.mimetype,
  profileImageName: req.file.originalname,
  profileImageSize: req.file.size,

  // Save the profile image API URL
  image: `http://localhost:5000/api/users/${id}/profile-image`,

  updatedAt: new Date(),
}
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Profile image uploaded successfully",
        imageUrl: `http://localhost:5000/api/users/${id}/profile-image`,
      });
    } catch (error) {
      console.error("Profile image upload error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to upload profile image",
      });
    }
  }
);


// ============================================================
// GET PROFILE IMAGE API
// ============================================================

app.get("/api/users/:id/profile-image", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send("Invalid user ID");
    }

    const user = await users.findOne(
      {
        _id: new ObjectId(id),
      },
      {
        projection: {
          profileImage: 1,
          profileImageContentType: 1,
        },
      }
    );

    if (!user || !user.profileImage) {
      return res.status(404).send("Profile image not found");
    }

    const contentType =
      user.profileImageContentType || "application/octet-stream";

    // MongoDB BSON Binary -> Node.js Buffer
    let imageBuffer;

    if (Buffer.isBuffer(user.profileImage)) {
      imageBuffer = user.profileImage;
    } else if (user.profileImage.buffer) {
      imageBuffer = user.profileImage.buffer;
    } else if (typeof user.profileImage.value === "function") {
      imageBuffer = user.profileImage.value();
    } else {
      imageBuffer = Buffer.from(user.profileImage);
    }

    res.set({
      "Content-Type": contentType,
      "Content-Length": imageBuffer.length,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    return res.end(imageBuffer);
  } catch (error) {
    console.error("Failed to fetch profile image:", error);

    return res.status(500).send("Failed to fetch profile image");
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