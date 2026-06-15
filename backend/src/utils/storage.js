import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import { uploadMedia as uploadToCloudinary } from "./cloudinary.js";
import { secureToken } from "./tokens.js";

function extensionFor(file, fileType) {
  return file.originalname?.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || (fileType === "video" ? "mp4" : "jpg");
}

function mediaKind(file) {
  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");
  if (!isImage && !isVideo) {
    const error = new Error("Only images and videos are allowed.");
    error.status = 400;
    throw error;
  }
  return isVideo ? "video" : "image";
}

async function uploadToS3(file) {
  const required = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    const error = new Error(`S3 storage is not configured. Missing ${missing.join(", ")}.`);
    error.status = 500;
    throw error;
  }

  const fileType = mediaKind(file);
  const extension = extensionFor(file, fileType);
  const key = `travel-share/uploads/${secureToken(12)}.${extension}`;
  const client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
  });

  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  }));

  const baseUrl = process.env.S3_PUBLIC_BASE_URL || (process.env.S3_ENDPOINT
    ? `${process.env.S3_ENDPOINT.replace(/\/$/, "")}/${process.env.S3_BUCKET}`
    : `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`);

  return {
    fileUrl: `${baseUrl}/${key}`,
    filePublicId: key,
    fileType
  };
}

function uploadToDevelopmentDataUrl(file) {
  const fileType = mediaKind(file);
  return {
    fileUrl: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
    filePublicId: `dev/${secureToken(12)}`,
    fileType
  };
}

async function uploadToLocalDisk(file) {
  const fileType = mediaKind(file);
  const extension = extensionFor(file, fileType);
  const filename = `${secureToken(12)}.${extension}`;
  const uploadDir = path.resolve(process.cwd(), "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), file.buffer);
  const baseUrl = (process.env.PUBLIC_UPLOAD_BASE_URL || process.env.BACKEND_URL || process.env.API_URL || "http://localhost:10000").replace(/\/$/, "");

  return {
    fileUrl: `${baseUrl}/uploads/${filename}`,
    filePublicId: `local/${filename}`,
    fileType
  };
}

export async function upload(file) {
  const provider = (process.env.STORAGE_PROVIDER || process.env.MEDIA_STORAGE_DRIVER || "local").toLowerCase();
  try {
    if (provider === "mock") {
      return await uploadToCloudinary(file);
    }

    if (provider === "cloudinary") {
      if (!process.env.CLOUDINARY_URL && !(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
        if (process.env.NODE_ENV !== "production") {
          return uploadToDevelopmentDataUrl(file);
        }
        return uploadToLocalDisk(file);
      }
      return await uploadToCloudinary(file);
    }

    if (provider === "local" || provider === "disk") {
      return await uploadToLocalDisk(file);
    }

    if (provider === "s3") {
      return await uploadToS3(file);
    }

    const error = new Error(`Unsupported STORAGE_PROVIDER "${provider}".`);
    error.status = 500;
    error.name = "StorageError";
    error.expose = true;
    throw error;
  } catch (err) {
    // Normalize storage errors so frontend gets a helpful message instead of "Something went wrong.".
    const e = new Error(err.message || "Storage upload failed.");
    e.status = err.status || 500;
    e.name = err.name || "StorageError";
    e.expose = true;
    throw e;
  }
}

export { upload as uploadMedia };
