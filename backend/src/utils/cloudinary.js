import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

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

export async function uploadMedia(file) {
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
  const buffer = isImage ? await sharp(file.buffer).rotate().toBuffer() : file.buffer;

  const result = await uploadBuffer(buffer, {
    folder: "travel-share/trips",
    resource_type: isVideo ? "video" : "image"
  });

  return {
    fileUrl: result.secure_url,
    filePublicId: result.public_id,
    fileType: isVideo ? "video" : "image"
  };
}
