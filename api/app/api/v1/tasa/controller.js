import { prisma } from "../../../database.js";

const select = { id: true, valor: true, createdAt: true };

// Tasa vigente = la más reciente
export const getActual = async (req, res, next) => {
  try {
    const result = await prisma.tasaCambio.findFirst({
      orderBy: { createdAt: "desc" },
      select,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const create = async (req, res, next) => {
  const { body = {}, decoded = {} } = req;
  // Acepta "870", 870 o "870,50"
  const valor = Number(String(body.valor ?? "").replace(",", "."));

  if (Number.isNaN(valor) || valor <= 0 || valor > 10000000) {
    return next({ message: "La tasa debe ser un número mayor a 0", status: 400 });
  }

  try {
    const result = await prisma.tasaCambio.create({
      data: { valor: Math.round(valor * 100) / 100, userId: decoded.id },
      select,
    });
    res.status(201);
    res.json({
      data: result,
      message: "Tasa del día actualizada. Los precios en Bs ya usan este valor",
    });
  } catch (error) {
    next(error);
  }
};

export const getHistorial = async (req, res, next) => {
  const limit = Math.min(Number(req.query.limit) || 15, 100);
  try {
    const result = await prisma.tasaCambio.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
