import { Router } from "express";

import { router as users } from "./users/routes.js";
import { router as products } from "./products/routes.js";
import { router as tasa } from "./tasa/routes.js";

// eslint-disable-next-line new-cap
export const router = Router();

router.use("/users", users);
router.use("/products", products);
router.use("/tasa", tasa);
