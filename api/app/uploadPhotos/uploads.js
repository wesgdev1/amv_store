import fs from "fs";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { configuration } from "../config.js";

const { cloudName, apiKey, apiSecret, folder } = configuration.cloudinary;

fs.mkdirSync(configuration.temp, { recursive: true });

// Archivos temporales en disco; solo imágenes, máx 10 MB y 8 por envío
export const uploads = multer({
  dest: configuration.temp,
  limits: { fileSize: 10 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    const error = new Error(`"${file.originalname}" no es una imagen`);
    error.status = 400;
    cb(error);
  },
});

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

/**
 * Sube una imagen ya optimizada para que pese poco:
 * - máx 1200 px por lado (sin agrandar las pequeñas)
 * - se guarda en WebP con calidad automática "eco"
 * Una foto de celular de 3-5 MB queda normalmente en ~60-200 KB.
 */
export const uploadFiles = async (file) => {
  const photoConfig = {
    folder,
    resource_type: "image",
    format: "webp",
    transformation: [
      { width: 1200, height: 1200, crop: "limit" },
      { quality: "auto:eco" },
    ],
    use_filename: true,
    unique_filename: true,
  };

  return cloudinary.uploader.upload(file, photoConfig);
};

export const deleteFile = async (publicId) => {
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (error) {
    console.log("Cloudinary destroy error:", error.message);
    return null;
  }
};

// Borra los temporales que dejó multer
export const cleanTemp = (files = []) => {
  files.forEach((file) => fs.unlink(file.path, () => {}));
};
