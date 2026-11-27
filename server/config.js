const env = process.env, path = require("path");
module.exports = {
  port: env.PORT || 3000,
  jwtSecret: env.JWT_SECRET || "dev-secret-change-me",
  tokenTtl: "7d", maxAttempts: 5, lockMs: 10 * 60 * 1000, requestTtlMs: 14 * 24 * 3600 * 1000, // pending requests expire after 14 days (UC-08)
  aiUrl: env.AI_URL || "http://127.0.0.1:8000", aiTimeoutMs: 1500, aiAdminToken: env.AI_ADMIN_TOKEN || "", aiRetrainHours: +env.AI_RETRAIN_HOURS || 0,
  mongoUrl: env.MONGO_URL || "", mongoDb: env.MONGO_DB || "roomiematch",
  appUrl: env.APP_URL || "http://localhost:3000", smtpUrl: env.SMTP_URL || "", mailFrom: env.MAIL_FROM || "RoomieMatch <no-reply@roomiematch.local>",
  s3Bucket: env.S3_BUCKET || "", s3Region: env.S3_REGION || "us-east-1", s3PublicUrl: env.S3_PUBLIC_URL || "",
  adminEmails: (env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
  dbFile: env.DB_FILE || path.join(__dirname, "data", "db.json"), photosDir: env.PHOTOS_DIR || path.join(__dirname, "data", "photos"),
  prod: env.NODE_ENV === "production",
};
