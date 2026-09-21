const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../db");
const upload = require("../middleware/upload");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/register", upload.single("avatar"), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      bloodGroup,
      district,
      upazila,
      role,
    } = req.body;
    const normalizedRole = role || "donor";

    if (
      !name?.trim() ||
      !email?.trim() ||
      !password ||
      !bloodGroup ||
      !district ||
      !upazila
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, blood group, district and upazila are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (!["donor", "volunteer"].includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid registration role",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile image is required",
      });
    }

    const existing = await db.users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      bloodGroup,
      district,
      upazila,
      image: "",
      profileImage: req.file.buffer,
      profileImageContentType: req.file.mimetype,
      profileImageName: req.file.originalname,
      profileImageSize: req.file.size,
      role: normalizedRole,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.users.insertOne(newUser);
    newUser._id = result.insertedId;
    newUser.image = `http://localhost:5000/api/users/${newUser._id}/profile-image`;

    await db.users.updateOne(
      { _id: newUser._id },
      { $set: { image: newUser.image } }
    );

    const token = signToken(newUser);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      data: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        bloodGroup: newUser.bloodGroup,
        district: newUser.district,
        upazila: newUser.upazila,
        image: newUser.image,
        role: newUser.role,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await db.users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const passwordMatch = user.password
      ? await bcrypt.compare(password, user.password)
      : false;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked",
      });
    }

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.patch("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password",
      });
    }

    if (!db.ObjectId.isValid(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const user = await db.users.findOne({
      _id: new db.ObjectId(req.user.id),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordMatch = user.password
      ? await bcrypt.compare(currentPassword, user.password)
      : false;

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.users.updateOne(
      { _id: new db.ObjectId(req.user.id) },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
