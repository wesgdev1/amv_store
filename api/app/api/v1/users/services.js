import { prisma } from "../../../database.js";
import { publicFields } from "./model.js";

export const findUserByEmail = (email) =>
  prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
  });

export const findUserById = (id) =>
  prisma.user.findUnique({
    where: { id },
    select: publicFields,
  });
