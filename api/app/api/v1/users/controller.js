import { prisma } from "../../../database.js";
import { signToken } from "../auth.js";
import { encryptPassword, verifyPassword } from "./model.js";
import { findUserByEmail, findUserById } from "./services.js";

export const signin = async (req, res, next) => {
  const { body = {} } = req;
  const { email, password } = body;

  if (!email || !password) {
    return next({ message: "Email y contraseña son obligatorios", status: 400 });
  }

  try {
    const user = await findUserByEmail(email);
    if (user === null || !user.state || user.role !== "admin") {
      return next({ message: "Credenciales inválidas", status: 401 });
    }

    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
      return next({ message: "Credenciales inválidas", status: 401 });
    }

    const token = signToken({ id: user.id, role: user.role });
    res.status(200).json({
      data: { ...user, password: undefined },
      meta: { token },
      message: "Sesión iniciada correctamente",
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  const { decoded = {} } = req;
  try {
    const user = await findUserById(decoded.id);
    if (user === null) {
      return next({ message: "Usuario no encontrado", status: 404 });
    }
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  const { body = {}, decoded = {} } = req;
  const { password, newPassword } = body;

  if (!password || !newPassword) {
    return next({ message: "Envía password y newPassword", status: 400 });
  }
  if (String(newPassword).length < 8) {
    return next({
      message: "La nueva contraseña debe tener mínimo 8 caracteres",
      status: 400,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { password: true },
    });
    if (user === null) {
      return next({ message: "Usuario no encontrado", status: 404 });
    }

    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
      return next({
        message: "La contraseña actual no coincide, revisa la información",
        status: 400,
      });
    }

    await prisma.user.update({
      where: { id: decoded.id },
      data: { password: await encryptPassword(newPassword) },
    });

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    next(error);
  }
};
