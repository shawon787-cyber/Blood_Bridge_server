const multer = require("multer");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      return callback(null, true);
    }

    const error = new Error(
      "Profile image must be a JPG, PNG, or WEBP file under 5MB."
    );
    error.code = "INVALID_FILE_TYPE";
    return callback(error);
  },
});

module.exports = upload;
