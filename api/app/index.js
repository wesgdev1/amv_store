import express from "express";
import cors from "cors";
import multer from "multer";
import { router as api } from "./api/v1/index.js";
import { configuration } from "./config.js";

export const app = express();

// CORS
app.use(cors());

app.use(express.json());

app.use("/api", api);
app.use("/api/v1", api);

// Front (tienda + /admin) servido desde la misma app
app.use(express.static(configuration.web.dir, { extensions: ["html"] }));

// Not route error handler
app.use((req, res, next) => {
  next({ message: "Route Not found", status: 404 });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let { message, status = 500 } = err;

  // Errores de subida (tamaño, cantidad de archivos...)
  if (err instanceof multer.MulterError) {
    status = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "Cada imagen debe pesar máximo 10 MB";
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Máximo 8 imágenes por envío (campo: images)";
    }
  }

  // Errores conocidos de Prisma
  if (err.code === "P2002") {
    status = 409;
    message = "Ya existe un registro con ese valor único";
  }
  if (err.code === "P2025") {
    status = 404;
    message = "Registro no encontrado";
  }

  if (status >= 500) console.error(err);

  res.status(status);
  res.json({ error: { message, status } });
});
