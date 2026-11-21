import { Router } from "express";

// eslint-disable-next-line new-cap
export const router = Router();

import * as controller from "./controller.js";
import { auth } from "../auth.js";
import { uploads } from "../../../uploadPhotos/uploads.js";

/**
 * Públicas (tienda):
 *  GET    /api/v1/products                 ?categoria=gorras|zapatos&destacado=true
 *  GET    /api/v1/products/tallas          tallas permitidas por categoría
 *  GET    /api/v1/products/slug/:slug
 *  GET    /api/v1/products/:id
 *
 * Admin (Bearer token):
 *  GET    /api/v1/products/admin           todos, incluso ocultos / sin foto
 *  POST   /api/v1/products                 multipart: campos + images[] (calzado o gorra)
 *  PUT    /api/v1/products/:id             JSON (whitelist de campos + tallas)
 *  DELETE /api/v1/products/:id             borra también sus fotos en Cloudinary
 *  POST   /api/v1/products/:id/images      multipart: images[]
 *  PATCH  /api/v1/products/:id/images/:imageId   marca como principal
 *  DELETE /api/v1/products/:id/images/:imageId
 */

router
  .route("/")
  .get(controller.getAll)
  .post(auth, uploads.array("images", 8), controller.create);

// Rutas estáticas ANTES de router.param / "/:id"
router.route("/tallas").get(controller.getTallas);
router.route("/admin").get(auth, controller.getAllAdmin);
router.route("/slug/:slug").get(controller.getBySlug);

router.param("id", controller.id);

router
  .route("/:id")
  .get(controller.read)
  .put(auth, controller.update)
  .patch(auth, controller.update)
  .delete(auth, controller.remove);

router
  .route("/:id/images")
  .post(auth, uploads.array("images", 8), controller.addImages);

router
  .route("/:id/images/:imageId")
  .patch(auth, controller.setPrincipal)
  .delete(auth, controller.removeImage);
