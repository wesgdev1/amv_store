import { Router } from "express";

// eslint-disable-next-line new-cap
export const router = Router();

import * as controller from "./controller.js";
import { auth } from "../auth.js";

/**
 * /api/v1/users/signin            POST - login del administrador
 * /api/v1/users/me                GET  - perfil del token actual
 * /api/v1/users/change-password   PUT  - cambiar contraseña
 * (No hay signup: el admin se crea con "npm run seed")
 */

router.route("/signin").post(controller.signin);
router.route("/me").get(auth, controller.me);
router.route("/change-password").put(auth, controller.changePassword);
