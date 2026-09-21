const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./db");
const upload = require("./middleware/upload");
const verifyToken = require("./middleware/verifyToken");
const {
  normalizeRole,
  verifyAdmin,
  verifyVolunteer,
  verifyAdminOrVolunteer,
  verifyActiveUser,
} = require("./middleware/authorize");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const { users, donationRequests, funding, ObjectId } = db;

const ALLOWED_STATUSES = ["pending", "inprogress", "done", "canceled"];

function normalizeStatus(value) {
  if (value === undefined || value === null) return null;
  return String(value).toLowerCase().replace(/\s+/g, "");
}

app.get("/", (req, res) => {
  res.send("Hello World");
});

// ============================================================
// AUTH (PUBLIC)
// ============================================================

app.use("/api/auth", require("./routes/auth"));

// ============================================================
// PUBLIC: FUNDING CHECKOUT
// ============================================================

app.use("/api/funding", require("./routes/funding"));

// ============================================================
// PUBLIC: SEARCH DONORS
// ============================================================

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
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      data: donors,
    });
  } catch (error) {
    console.error("Failed to fetch donors:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch donors",
    });
  }
});

// ============================================================
// PUBLIC: PENDING DONATION REQUESTS ONLY
// ============================================================

app.get("/api/donation-requests", async (req, res) => {
  try {
    const result = await donationRequests
      .find({ status: { $regex: /^pending$/i } })
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

// ============================================================
// PUBLIC: COMPLETED DONATION HISTORY
// ============================================================

app.get("/api/donation-history", async (req, res) => {
  try {
    const history = await donationRequests
      .find({
        status: { $regex: /^done$/i },
      })
      .sort({
        completedAt: -1,
        createdAt: -1,
      })
      .limit(4)
      .toArray();

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Failed to fetch donation history:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch donation history",
    });
  }
});

// ============================================================
// PUBLIC: DONATION COUNT BY USER ID (count only, not sensitive)
// ============================================================

app.get("/api/donation-count/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const totalDonations = await donationRequests.countDocuments({
      userId: userId,
      status: { $regex: /^done$/i },
    });

    return res.status(200).json({
      success: true,
      data: {
        totalDonations,
      },
    });
  } catch (error) {
    console.error("Failed to fetch donation count:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch donation count",
    });
  }
});

// ============================================================
// PUBLIC: DONATION REQUEST STATISTICS (counts only)
// ============================================================

app.get("/api/donation-requests/stats", async (req, res) => {
  try {
    const total = await donationRequests.countDocuments();

    const pending = await donationRequests.countDocuments({
      status: { $regex: /^pending$/i },
    });

    const inProgress = await donationRequests.countDocuments({
      status: { $regex: /^inprogress$/i },
    });

    const done = await donationRequests.countDocuments({
      status: { $regex: /^done$/i },
    });

    const cancelled = await donationRequests.countDocuments({
      status: { $regex: /^canceled$/i },
    });

    return res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        inProgress,
        done,
        cancelled,
      },
    });
  } catch (error) {
    console.error("Failed to fetch donation request statistics:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch donation request statistics",
    });
  }
});

// ============================================================
// GET USER (AUTHENTICATED) - never expose password / secrets
// ============================================================

app.get("/api/user/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await users.findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          password: 0,
          __v: 0,
        },
      }
    );

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

// ============================================================
// GET OWN PROFILE (AUTHENTICATED, OWNER OR ADMIN)
// ============================================================

app.get("/api/users/:id/profile", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const role = normalizeRole(req.user.role);
    if (req.user.id !== id && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only access your own profile",
      });
    }

    const user = await users.findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          password: 0,
          __v: 0,
        },
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
});

// ============================================================
// UPDATE OWN PROFILE (AUTHENTICATED, OWNER OR ADMIN)
// Email and role/status are NEVER accepted from the body.
// ============================================================

app.patch("/api/users/:id/profile", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const role = normalizeRole(req.user.role);
    if (req.user.id !== id && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you can only update your own profile",
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
      if (req.body[field] !== undefined && req.body[field] !== null) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const result = await users.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await users.findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0, __v: 0 } }
    );

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

// ============================================================
// PROFILE IMAGE UPLOAD (AUTHENTICATED, OWNER OR ADMIN)
// ============================================================

app.post(
  "/api/users/:id/profile-image",
  verifyToken,
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

      const role = normalizeRole(req.user.role);
      if (req.user.id !== id && role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Forbidden: you can only upload your own profile image",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

      const user = await users.findOne({ _id: new ObjectId(id) });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const result = await users.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            profileImage: req.file.buffer,
            profileImageContentType: req.file.mimetype,
            profileImageName: req.file.originalname,
            profileImageSize: req.file.size,
            image: `http://localhost:5000/api/users/${id}/profile-image`,
            updatedAt: new Date(),
          },
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
// GET PROFILE IMAGE (PUBLIC - image binary only)
// ============================================================

app.get("/api/users/:id/profile-image", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send("Invalid user ID");
    }

    const user = await users.findOne(
      { _id: new ObjectId(id) },
      { projection: { profileImage: 1, profileImageContentType: 1 } }
    );

    if (!user || !user.profileImage) {
      return res.status(404).send("Profile image not found");
    }

    const contentType =
      user.profileImageContentType || "application/octet-stream";

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

// ============================================================
// CREATE DONATION REQUEST
// verifyToken + verifyActiveUser
// Requester identity derived from verified JWT. Status forced pending.
// ============================================================

app.post(
  "/api/donation-requests",
  verifyToken,
  verifyActiveUser,
  async (req, res) => {
    try {
      const dbUser = req.dbUser;
      const requesterEmail = dbUser.email;
      const requesterName = dbUser.name;
      const requesterId = dbUser._id.toString();

      const {
        recipientName,
        hospitalName,
        fullAddress,
        bloodGroup,
        donationDate,
        requestMessage,
        district,
        upazila,
        contactNumber,
      } = req.body;

      if (!recipientName || !hospitalName || !bloodGroup) {
        return res.status(400).json({
          success: false,
          message:
            "Recipient name, hospital name and blood group are required",
        });
      }

      const donationRequest = {
        recipientName,
        hospitalName,
        fullAddress: fullAddress || "",
        bloodGroup,
        donationDate: donationDate || null,
        requestMessage: requestMessage || "",
        district: district || dbUser.district || "",
        upazila: upazila || dbUser.upazila || "",
        contactNumber: contactNumber || "",

        requesterId,
        requesterEmail,
        requesterName,
        userId: requesterId,

        donorId: null,
        donorEmail: null,
        donorName: null,

        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await donationRequests.insertOne(donationRequest);

      return res.status(201).json({
        success: true,
        message: "Donation request created successfully",
        insertedId: result.insertedId,
      });
    } catch (error) {
      console.error("Failed to create donation request:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create donation request",
      });
    }
  }
);

// ============================================================
// MY DONATION REQUESTS (AUTHENTICATED)
// Returns only requests owned by the verified user.
// Supports pagination + status filtering.
// ============================================================

app.get("/api/donation-requests/my-requests", verifyToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = {
      $or: [{ userId: req.user.id }, { requesterEmail: req.user.email }],
    };

    const statusParam = req.query.status
      ? normalizeStatus(req.query.status)
      : null;
    if (statusParam) {
      if (!ALLOWED_STATUSES.includes(statusParam)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter",
        });
      }
      query.status = { $regex: `^${statusParam}$`, $options: "i" };
    }

    const total = await donationRequests.countDocuments(query);
    const data = await donationRequests
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch my requests:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch my requests",
    });
  }
});

// ============================================================
// ALL DONATION REQUESTS (ADMIN OR VOLUNTEER)
// Supports pagination + status filtering.
// ============================================================

app.get(
  "/api/donation-requests/all",
  verifyToken,
  verifyAdminOrVolunteer,
  async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit) || 20, 1),
        100
      );
      const skip = (page - 1) * limit;

      const query = {};
      const statusParam = req.query.status
        ? normalizeStatus(req.query.status)
        : null;
      if (statusParam) {
        if (!ALLOWED_STATUSES.includes(statusParam)) {
          return res.status(400).json({
            success: false,
            message: "Invalid status filter",
          });
        }
        query.status = { $regex: `^${statusParam}$`, $options: "i" };
      }

      const total = await donationRequests.countDocuments(query);
      const data = await donationRequests
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      return res.status(200).json({
        success: true,
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Failed to fetch all requests:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch all requests",
      });
    }
  }
);

// ============================================================
// GET DONATION REQUEST DETAIL (AUTHENTICATED)
// ============================================================

app.get("/api/donation-requests/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid donation request ID",
      });
    }

    const request = await donationRequests.findOne({ _id: new ObjectId(id) });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Donation request not found",
      });
    }

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
// DONATE TO REQUEST (AUTHENTICATED + ACTIVE)
// Only pending requests can be accepted. Donor identity from JWT.
// ============================================================

app.patch(
  "/api/donation-requests/:id/donate",
  verifyToken,
  verifyActiveUser,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid donation request ID",
        });
      }

      const request = await donationRequests.findOne({
        _id: new ObjectId(id),
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Donation request not found",
        });
      }

      const currentStatus = normalizeStatus(request.status);
      if (currentStatus !== "pending") {
        return res.status(409).json({
          success: false,
          message: "This request is no longer available for donation",
        });
      }

      if (request.donorId) {
        return res.status(409).json({
          success: false,
          message: "A donor has already been assigned to this request",
        });
      }

      const dbUser = req.dbUser;

      const updateData = {
        status: "inprogress",
        donorId: dbUser._id.toString(),
        donorEmail: dbUser.email,
        donorName: dbUser.name,
        updatedAt: new Date(),
      };

      const result = await donationRequests.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to accept donation request",
        });
      }

      const updatedRequest = await donationRequests.findOne({
        _id: new ObjectId(id),
      });

      return res.status(200).json({
        success: true,
        message: "You are now assigned to this donation request",
        data: updatedRequest,
      });
    } catch (error) {
      console.error("Failed to donate:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to donate",
      });
    }
  }
);

// ============================================================
// UPDATE DONATION REQUEST (OWNER DONOR OR ADMIN)
// Volunteers cannot edit general request info.
// Status is never accepted from the body here.
// ============================================================

app.patch("/api/donation-requests/:id/update", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid donation request ID",
      });
    }

    const request = await donationRequests.findOne({ _id: new ObjectId(id) });
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Donation request not found",
      });
    }

    const role = normalizeRole(req.user.role);

    if (role === "volunteer") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: volunteers cannot edit donation requests",
      });
    }

    if (role !== "admin") {
      const owns =
        request.requesterEmail === req.user.email ||
        request.userId === req.user.id;
      if (!owns) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: you can only edit your own request",
        });
      }
    }

    const editableFields = [
      "recipientName",
      "hospitalName",
      "fullAddress",
      "bloodGroup",
      "donationDate",
      "requestMessage",
      "district",
      "upazila",
      "contactNumber",
    ];

    const updateData = { updatedAt: new Date() };
    editableFields.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        updateData[field] = req.body[field];
      }
    });

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update",
      });
    }

    const result = await donationRequests.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Donation request not found",
      });
    }

    const updatedRequest = await donationRequests.findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "Donation request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Failed to update donation request:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update donation request",
    });
  }
});

// ============================================================
// DELETE DONATION REQUEST (OWNER DONOR OR ADMIN)
// Volunteers cannot delete requests.
// ============================================================

app.delete("/api/donation-requests/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid donation request ID",
      });
    }

    const request = await donationRequests.findOne({ _id: new ObjectId(id) });
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Donation request not found",
      });
    }

    const role = normalizeRole(req.user.role);

    if (role === "volunteer") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: volunteers cannot delete donation requests",
      });
    }

    if (role !== "admin") {
      const owns =
        request.requesterEmail === req.user.email ||
        request.userId === req.user.id;
      if (!owns) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: you can only delete your own request",
        });
      }
    }

    const result = await donationRequests.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Donation request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Donation request deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete donation request:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete donation request",
    });
  }
});

// ============================================================
// UPDATE DONATION REQUEST STATUS (ADMIN OR VOLUNTEER)
// Only the status field may be changed. Volunteers may NOT modify
// requester / donor identity / blood group / recipient / hospital /
// address / date / message.
// ============================================================

app.patch(
  "/api/donation-requests/:id/status",
  verifyToken,
  verifyAdminOrVolunteer,
  async (req, res) => {
    try {
      const { id } = req.params;
      const incoming = normalizeStatus(req.body.status);

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid donation request ID",
        });
      }

      if (!incoming || !ALLOWED_STATUSES.includes(incoming)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid status. Allowed: pending, inprogress, done, canceled",
        });
      }

      const request = await donationRequests.findOne({
        _id: new ObjectId(id),
      });

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Donation request not found",
        });
      }

      const updateData = {
        status: incoming,
        updatedAt: new Date(),
      };

      if (incoming === "done") {
        updateData.completedAt = new Date();
      }
      if (incoming === "canceled") {
        updateData.cancelledAt = new Date();
      }

      const result = await donationRequests.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to update donation request status",
        });
      }

      const updatedRequest = await donationRequests.findOne({
        _id: new ObjectId(id),
      });

      return res.status(200).json({
        success: true,
        message: `Request status updated to ${incoming}`,
        data: updatedRequest,
      });
    } catch (error) {
      console.error("Failed to update donation request status:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update donation request status",
      });
    }
  }
);

// ============================================================
// ADMIN: LIST ALL USERS (ADMIN ONLY)
// ============================================================

app.get("/api/admin/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const usersData = await users
      .find(
        {},
        {
          projection: {
            password: 0,
            profileImage: 0,
            __v: 0,
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
          : user.role === "admin" || user.role === "administrator"
          ? "Admin"
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

// ============================================================
// ADMIN: BLOCK / UNBLOCK USER (ADMIN ONLY)
// ============================================================

app.patch(
  "/api/admin/users/:id/status",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      if (id === req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: you cannot change your own status",
        });
      }

      const target = req.body.status || req.body.action;
      const nextStatus = String(target || "").toLowerCase();

      if (nextStatus !== "blocked" && nextStatus !== "active") {
        return res.status(400).json({
          success: false,
          message: "Status must be 'active' or 'blocked'",
        });
      }

      const user = await users.findOne({ _id: new ObjectId(id) });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.status === nextStatus) {
        return res.status(400).json({
          success: false,
          message: `User is already ${nextStatus}`,
        });
      }

      const result = await users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: nextStatus, updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to update user status",
        });
      }

      const updatedUser = await users.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0, profileImage: 0, __v: 0 } }
      );

      return res.status(200).json({
        success: true,
        message: `User ${nextStatus} successfully`,
        data: updatedUser,
      });
    } catch (error) {
      console.error("Failed to update user status:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update user status",
      });
    }
  }
);

// ============================================================
// ADMIN: MAKE VOLUNTEER (ADMIN ONLY, NOT SELF)
// ============================================================

app.patch(
  "/api/admin/users/:id/make-volunteer",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      if (id === req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: you cannot change your own role",
        });
      }

      const user = await users.findOne({ _id: new ObjectId(id) });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.role === "volunteer") {
        return res.status(400).json({
          success: false,
          message: "User is already a volunteer",
        });
      }

      const result = await users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "volunteer", updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to update user role",
        });
      }

      const updatedUser = await users.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0, profileImage: 0, __v: 0 } }
      );

      return res.status(200).json({
        success: true,
        message: "User is now a volunteer",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Failed to make volunteer:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to make volunteer",
      });
    }
  }
);

// ============================================================
// ADMIN: MAKE ADMIN (ADMIN ONLY, NOT SELF)
// ============================================================

app.patch(
  "/api/admin/users/:id/make-admin",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      if (id === req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: you cannot change your own role",
        });
      }

      const user = await users.findOne({ _id: new ObjectId(id) });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.role === "admin" || user.role === "administrator") {
        return res.status(400).json({
          success: false,
          message: "User is already an admin",
        });
      }

      const result = await users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "admin", updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to update user role",
        });
      }

      const updatedUser = await users.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0, profileImage: 0, __v: 0 } }
      );

      return res.status(200).json({
        success: true,
        message: "User is now an admin",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Failed to make admin:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to make admin",
      });
    }
  }
);

// ============================================================
// ADMIN: BLOCK USER (legacy endpoint, ADMIN ONLY)
// ============================================================

app.patch(
  "/api/admin/users/:id/block",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      if (id === req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: you cannot block yourself",
        });
      }

      const user = await users.findOne({ _id: new ObjectId(id) });
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
        { _id: new ObjectId(id) },
        { $set: { status: "blocked", updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to block user",
        });
      }

      const updatedUser = await users.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0, profileImage: 0, __v: 0 } }
      );

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
  }
);

// ============================================================
// ADMIN: UNBLOCK USER (legacy endpoint, ADMIN ONLY)
// ============================================================

app.patch(
  "/api/admin/users/:id/unblock",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const user = await users.findOne({ _id: new ObjectId(id) });
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
        { _id: new ObjectId(id) },
        { $set: { status: "active", updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to unblock user",
        });
      }

      const updatedUser = await users.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0, profileImage: 0, __v: 0 } }
      );

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
  }
);

// ============================================================
// ADMIN: TOGGLE DONOR <-> VOLUNTEER (ADMIN ONLY, NOT SELF)
// ============================================================

app.patch(
  "/api/admin/users/:id/toggle-role",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      if (id === req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: you cannot change your own role",
        });
      }

      const user = await users.findOne({ _id: new ObjectId(id) });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.role !== "donor" && user.role !== "volunteer") {
        return res.status(400).json({
          success: false,
          message: "Only donor and volunteer roles can be switched",
        });
      }

      const newRole = user.role === "donor" ? "volunteer" : "donor";

      const result = await users.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: newRole, updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to change user role",
        });
      }

      const updatedUser = await users.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0, profileImage: 0, __v: 0 } }
      );

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
  }
);

// ============================================================
// ADMIN: DASHBOARD STATISTICS (ADMIN ONLY)
// ============================================================

app.get("/api/admin/stats", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await users.countDocuments();
    const totalDonors = await users.countDocuments({ role: "donor" });
    const totalVolunteers = await users.countDocuments({ role: "volunteer" });
    const totalAdmins = await users.countDocuments({
      role: { $in: ["admin", "administrator"] },
    });
    const blockedUsers = await users.countDocuments({ status: "blocked" });

    const totalRequests = await donationRequests.countDocuments();
    const pendingRequests = await donationRequests.countDocuments({
      status: { $regex: /^pending$/i },
    });
    const inProgressRequests = await donationRequests.countDocuments({
      status: { $regex: /^inprogress$/i },
    });
    const doneRequests = await donationRequests.countDocuments({
      status: { $regex: /^done$/i },
    });
    const canceledRequests = await donationRequests.countDocuments({
      status: { $regex: /^canceled$/i },
    });

    const fundingAgg = await funding
      .aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, totalFunding: { $sum: "$amount" } } },
      ])
      .toArray();
    const totalFunding = fundingAgg[0] ? fundingAgg[0].totalFunding : 0;

    return res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          donors: totalDonors,
          volunteers: totalVolunteers,
          admins: totalAdmins,
          blocked: blockedUsers,
        },
        donationRequests: {
          total: totalRequests,
          pending: pendingRequests,
          inProgress: inProgressRequests,
          done: doneRequests,
          canceled: canceledRequests,
        },
        funding: {
          total: totalFunding,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin stats",
    });
  }
});

// ============================================================
// VOLUNTEER DASHBOARD STATS (ADMIN OR VOLUNTEER)
// Volunteers do NOT get user-management/admin data here.
// ============================================================

app.get(
  "/api/volunteer/stats",
  verifyToken,
  verifyAdminOrVolunteer,
  async (req, res) => {
    try {
      const totalRequests = await donationRequests.countDocuments();
      const pendingRequests = await donationRequests.countDocuments({
        status: { $regex: /^pending$/i },
      });
      const inProgressRequests = await donationRequests.countDocuments({
        status: { $regex: /^inprogress$/i },
      });
      const doneRequests = await donationRequests.countDocuments({
        status: { $regex: /^done$/i },
      });
      const canceledRequests = await donationRequests.countDocuments({
        status: { $regex: /^canceled$/i },
      });

      return res.status(200).json({
        success: true,
        data: {
          total: totalRequests,
          pending: pendingRequests,
          inProgress: inProgressRequests,
          done: doneRequests,
          canceled: canceledRequests,
        },
      });
    } catch (error) {
      console.error("Failed to fetch volunteer stats:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch volunteer stats",
      });
    }
  }
);



// ============================================================
// SERVER BOOTSTRAP
// ============================================================

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "Profile image must be a JPG, PNG, or WEBP file under 5MB.",
    });
  }

  if (error.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Invalid request body",
    });
  }

  console.error("Unhandled server error:", error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode && error.statusCode < 500
      ? error.message
      : "Internal server error",
  });
});

async function run() {
  try {
    await db.client.connect();

    await db.client.db("admin").command({ ping: 1 });

    await funding.createIndex(
      { stripeSessionId: 1 },
      { unique: true, sparse: true, name: "funding_stripe_session_id_unique" }
    );

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

// === APPEND_POINTS ===
