import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

export async function uploadMedia(file, options = {}) {
  if (process.env.MEDIA_STORAGE_DRIVER === "mock") {
    return {
      fileUrl: `https://media.test/${encodeURIComponent(file.originalname || "upload")}`,
      filePublicId: `mock/${Date.now()}`,
      fileType: file.mimetype.startsWith("video/") ? "video" : "image"
    };
  }

  const isImage = file.mimetype.startsWith("image/");
  const isVideo = file.mimetype.startsWith("video/");

  if (!isImage && !isVideo) {
    const error = new Error("Only images and videos are allowed.");
    error.status = 400;
    throw error;
  }

  // Re-encoding images removes EXIF metadata such as GPS, timestamps, and device info.
  let buffer = file.buffer;
  if (isImage) {
    try {
      const sharpModule = await import('sharp');
      const sharpFn = sharpModule?.default || sharpModule;
      buffer = await sharpFn(file.buffer).rotate().toBuffer();
    } catch (err) {
      // If sharp can't be loaded (missing platform binary), fall back to original buffer
      // and log the error to help debugging deploy logs.
      console.warn('sharp unavailable, skipping re-encode of image buffer:', err && err.message);
      buffer = file.buffer;
    }
  }

  const uploadOpts = {
    folder: "travel-share/trips",
    resource_type: isVideo ? "video" : "image"
  };
  if (options && options.key) uploadOpts.public_id = options.key.replace(/^travel-share\//, '') ;

  const result = await uploadBuffer(buffer, uploadOpts);

  return {
    fileUrl: result.secure_url,
    filePublicId: result.public_id,
    fileType: isVideo ? "video" : "image"
  };
}

function attachmentName({ id, caption, createdAt, filePublicId }) {
  const title = String(caption || filePublicId || id || "memory")
    .split("/")
    .pop()
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "memory";
  const date = createdAt ? new Date(createdAt).toISOString().slice(0, 10) : "";
  return ["travel-share", title, date].filter(Boolean).join("-");
}

export function signedMediaUrl({ id, caption, createdAt, filePublicId, fileType, expiresInSeconds = 300 }, options = {}) {
  if (!filePublicId || filePublicId.startsWith("mock/")) return null;
  if (!process.env.CLOUDINARY_URL && !(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
    return null;
  }
  const watermarkText = options.watermarkText?.trim();
  const transformation = watermarkText ? [{
    overlay: {
      font_family: "Arial",
      font_size: 40,
      font_weight: "bold",
      text: watermarkText
    },
    color: "white",
    opacity: 60,
    gravity: "south_east",
    x: 24,
    y: 24,
    effect: "shadow"
  }] : undefined;

  const opts = {
    resource_type: fileType === "video" ? "video" : "image",
    type: "upload",
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  if (transformation) opts.transformation = transformation;
  if (options.attachment) opts.flags = `attachment:${attachmentName({ id, caption, createdAt, filePublicId })}`;

  return cloudinary.url(filePublicId, opts);
}
