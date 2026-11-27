// Profile pictures: validated, then stored on local disk (/photos/<random>.<ext>) or in S3 when S3_BUCKET is set
// (needs the optional @aws-sdk/client-s3 package; set S3_REGION and optionally S3_PUBLIC_URL for a CDN).
const fs = require("fs"), path = require("path"), crypto = require("crypto"), cfg = require("../config");
const dir = cfg.photosDir;
fs.mkdirSync(dir, { recursive: true });
const MAGIC = { jpg: b => b[0] === 0xff && b[1] === 0xd8, png: b => b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG", webp: b => b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" };
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
let s3, sdk;
const client = () => { sdk = sdk || require("@aws-sdk/client-s3"); s3 = s3 || new sdk.S3Client({ region: cfg.s3Region }); return s3; };
const base = () => (cfg.s3PublicUrl || `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com`).replace(/\/$/, "");

async function remove(u) {
  const p = u.photo; u.photo = ""; if (!p) return;
  try {
    if (/^https?:\/\//.test(p)) { if (cfg.s3Bucket) await client().send(new sdk.DeleteObjectCommand({ Bucket: cfg.s3Bucket, Key: "photos/" + path.basename(p) })); }
    else fs.unlinkSync(path.join(dir, path.basename(p)));
  } catch (e) {}
}
async function save(u, dataUrl) { // returns an error message, or null on success
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return "Unsupported image. Use JPG, PNG or WebP.";
  const buf = Buffer.from(m[2], "base64"), ext = m[1] === "jpeg" ? "jpg" : m[1];
  if (buf.length > 300 * 1024) return "Image is too large (max 300 KB).";
  if (!MAGIC[ext](buf)) return "That file is not a valid image.";
  const name = crypto.randomBytes(10).toString("hex") + "." + ext;
  if (cfg.s3Bucket) { await client().send(new sdk.PutObjectCommand({ Bucket: cfg.s3Bucket, Key: "photos/" + name, Body: buf, ContentType: MIME[ext], CacheControl: "public,max-age=86400" })); await remove(u); u.photo = base() + "/photos/" + name; }
  else { fs.writeFileSync(path.join(dir, name), buf); await remove(u); u.photo = "/photos/" + name; }
  return null;
}
module.exports = { dir, save, remove };
