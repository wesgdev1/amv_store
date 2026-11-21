import bcrypt from "bcrypt";

// Campos que se pueden devolver (nunca password)
export const publicFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  state: true,
  createdAt: true,
};

export const encryptPassword = (password) => bcrypt.hash(password, 10);

export const verifyPassword = (password, encryptedPassword) =>
  bcrypt.compare(password, encryptedPassword);
