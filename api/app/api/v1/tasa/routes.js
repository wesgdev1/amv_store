import { Router } from "express";

// eslint-disable-next-line new-cap
export const router = Router();

import * as controller from "./controller.js";
import { auth } from "../auth.js";

/**
 * /api/v1/tasa            GET  - tasa vigente (pública, la usa la tienda)
 * /api/v1/tasa            POST - nueva tasa del día { valor } (admin)
 * /api/v1/tasa/historial  GET  - últimos cambios (admin)
 */

router.route("/").get(controller.getActual).post(auth, controller.create);
router.route("/historial").get(auth, controller.getHistorial);
