const db = require("../db");

function normalizeRole(role) {
  if (role === "administrator" || role === "admin") return "admin";
  if (role === "volunteer") return "volunteer";
  if (role === "donor") return "donor";
  return role;
}

function verifyAdmin(req, res, next) {
  if (normalizeRole(req.user.role) !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: admin access required",
    });
  }
  next();
}

function verifyVolunteer(req, res, next) {
  if (normalizeRole(req.user.role) !== "volunteer") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: volunteer access required",
    });
  }
  next();
}

function verifyAdminOrVolunteer(req, res, next) {
  const role = normalizeRole(req.user.role);
  if (role !== "admin" && role !== "volunteer") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: admin or volunteer access required",
    });
  }
  next();
}

async function verifyActiveUser(req, res, next) {
  try {
    const userId = req.user && req.user.id;

    if (!userId || !db.ObjectId.isValid(userId)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await db.users.findOne({ _id: new db.ObjectId(userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. You cannot perform this action.",
      });
    }

    req.dbUser = user;
    next();
  } catch (error) {
    console.error("verifyActiveUser error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

module.exports = {
  normalizeRole,
  verifyAdmin,
  verifyVolunteer,
  verifyAdminOrVolunteer,
  verifyActiveUser,
};
