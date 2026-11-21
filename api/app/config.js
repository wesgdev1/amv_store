import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const configuration = {
  server: {
    port: process.env.PORT || 3000,
  },
  token: {
    secret: process.env.TOKEN_SECRET,
    expires: process.env.TOKEN_EXPIRES || "8h",
  },
  cloudinary: {
    cloudName: process.env.CLOUD_NAME,
    apiKey: process.env.API_KEY,
    apiSecret: process.env.API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || "amv-store/products",
  },
  web: {
    dir: path.resolve(root, process.env.WEB_DIR || "../web"),
  },
  temp: path.resolve(root, "temp"),
};
