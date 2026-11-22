import { prisma } from "../../../database.js";
import {
  uploadFiles,
  deleteFile,
  cleanTemp,
} from "../../../uploadPhotos/uploads.js";
import {
  CATEGORIAS,
  ETIQUETAS,
  PROMO,
  BROCHE,
  TIPOS_GORRA,
  TALLAS_GORRA,
  TALLAS_CALZADO,
  include,
  isUUID,
  httpError,
  slugify,
  normalizeTallas,
  parseProductBody,
  applyPromo,
  applyTipo,
  serialize,
} from "./model.js";

// En la tienda solo se ven productos activos, con foto y tallas disponibles
const publicInclude = {
  ...include,
  tallas: { where: { disponible: true }, orderBy: { orden: "asc" } },
};
const publicWhere = { activo: true, images: { some: {} } };

/* ---------- Helpers ---------- */

const uniqueSlug = async (nombre) => {
  const base = slugify(nombre) || "producto";
  const existentes = await prisma.product.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const usados = new Set(existentes.map((p) => p.slug));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

// Sube todas las fotos; si alguna falla, borra las que sí subieron
const uploadAll = async (files) => {
  const results = await Promise.allSettled(
    files.map((file) => uploadFiles(file.path)),
  );
  const ok = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) {
    await Promise.all(ok.map((u) => deleteFile(u.public_id)));
    console.log("Cloudinary upload error:", failed.reason);
    throw httpError(
      `No se pudo subir una imagen a Cloudinary: ${
        failed.reason?.message || "error desconocido"
      }`,
      502,
    );
  }
  return ok;
};

const toImageData = (uploaded, desde = 0) =>
  uploaded.map((u, i) => ({
    url: u.secure_url,
    publicId: u.public_id,
    bytes: u.bytes,
    orden: desde + i,
  }));

/* ---------- Públicas ---------- */

export const getAll = async (req, res, next) => {
  const { query = {} } = req;
  const where = { ...publicWhere };

  if (query.categoria) {
    if (!CATEGORIAS.includes(query.categoria)) {
      return next({ message: "Categoría inválida", status: 400 });
    }
    where.categoria = query.categoria;
  }
  if (query.destacado !== undefined) {
    where.destacado = query.destacado === "true";
  }
  if (query.promo === "true") where.etiqueta = PROMO;

  try {
    const result = await prisma.product.findMany({
      where,
      include: publicInclude,
      orderBy: { createdAt: "desc" },
    });
    // Sin tallas disponibles no se puede pedir: no se muestra
    // (las gorras de broche no llevan tallas: talla única)
    res.json({
      data: result
        .filter((p) => p.tipo === BROCHE || p.tallas.length > 0)
        .map(serialize),
    });
  } catch (error) {
    next(error);
  }
};

export const getBySlug = async (req, res, next) => {
  const { slug } = req.params;
  try {
    const result = await prisma.product.findFirst({
      where: { ...publicWhere, slug },
      include: publicInclude,
    });
    if (result === null) {
      return next({ message: "Producto no encontrado", status: 404 });
    }
    res.json({ data: serialize(result) });
  } catch (error) {
    next(error);
  }
};

export const getTallas = async (req, res) => {
  res.json({
    data: {
      categorias: CATEGORIAS,
      etiquetas: ETIQUETAS,
      tiposGorra: TIPOS_GORRA,
      tallas: { gorras: TALLAS_GORRA, zapatos: TALLAS_CALZADO },
    },
  });
};

/* ---------- Admin ---------- */

export const getAllAdmin = async (req, res, next) => {
  const { query = {} } = req;
  const where = {};
  if (CATEGORIAS.includes(query.categoria)) where.categoria = query.categoria;
  if (query.q) {
    where.nombre = { contains: String(query.q), mode: "insensitive" };
  }

  try {
    const result = await prisma.product.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: result.map(serialize) });
  } catch (error) {
    next(error);
  }
};

/**
 * Crea un calzado o una gorra (multipart/form-data):
 *  nombre, categoria (gorras|zapatos), tipo? (CERRADA|BROCHE, solo gorras),
 *  precioUSD, descripcion?, etiqueta?, destacado?, activo?,
 *  tallas (JSON, no aplica a gorras de broche) e images[] (1 a 8 fotos)
 */
export const create = async (req, res, next) => {
  const files = req.files || [];
  let uploaded = [];

  try {
    const data = applyTipo(applyPromo(parseProductBody(req.body)));
    const tallas = normalizeTallas(data.categoria, req.body.tallas, data.tipo);
    if (files.length === 0) {
      throw httpError("Sube al menos una foto del producto", 400);
    }

    const slug = await uniqueSlug(data.nombre);
    uploaded = await uploadAll(files);

    const result = await prisma.product.create({
      data: {
        ...data,
        slug,
        tallas: { create: tallas },
        images: { create: toImageData(uploaded) },
      },
      include,
    });

    res.status(201);
    res.json({
      data: serialize(result),
      message: `${data.categoria === "gorras" ? "Gorra" : "Calzado"} creado correctamente`,
    });
  } catch (error) {
    // Si falló la BD, no dejar fotos huérfanas en Cloudinary
    await Promise.all(uploaded.map((u) => deleteFile(u.public_id)));
    next(error);
  } finally {
    cleanTemp(files);
  }
};

// Middleware de router.param: carga el producto en req.data o 404
export const id = async (req, res, next) => {
  const { params = {} } = req;

  if (!isUUID(params.id)) {
    return next({ message: "Producto no encontrado", status: 404 });
  }

  try {
    const result = await prisma.product.findUnique({
      where: { id: params.id },
      include,
    });
    if (result === null) {
      next({ message: "Producto no encontrado", status: 404 });
    } else {
      req.data = result;
      next();
    }
  } catch (error) {
    next(error);
  }
};

export const read = async (req, res) => {
  res.json({ data: serialize(req.data) });
};

export const update = async (req, res, next) => {
  const { params = {}, body = {}, data: actual } = req;

  try {
    const data = applyTipo(
      applyPromo(parseProductBody(body, { partial: true }), actual),
      actual,
    );
    const categoria = data.categoria ?? actual.categoria;
    const tipo = data.tipo !== undefined ? data.tipo : actual.tipo;
    const cambiaCategoria = categoria !== actual.categoria;
    // Gorras antiguas sin tipo cuentan como CERRADA
    const tipoActual =
      actual.categoria === "gorras" ? actual.tipo || "CERRADA" : null;
    const cambiaTipo = (tipo ?? null) !== tipoActual;

    // Si cambia la categoría o el tipo, las tallas deben corresponder
    let tallas;
    if (body.tallas !== undefined || cambiaCategoria || cambiaTipo) {
      tallas = normalizeTallas(categoria, body.tallas, tipo);
    }

    const result = await prisma.$transaction(async (tx) => {
      if (tallas) {
        await tx.talla.deleteMany({ where: { productId: params.id } });
        await tx.talla.createMany({
          data: tallas.map((t) => ({ ...t, productId: params.id })),
        });
      }
      return tx.product.update({
        where: { id: params.id },
        data,
        include,
      });
    });

    res.json({
      data: serialize(result),
      message: "Producto actualizado correctamente",
    });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  const { params = {}, data: actual } = req;

  try {
    await prisma.product.delete({ where: { id: params.id } });
    await Promise.all(actual.images.map((i) => deleteFile(i.publicId)));
    res.status(204);
    res.end();
  } catch (error) {
    next(error);
  }
};

/* ---------- Imágenes ---------- */

export const addImages = async (req, res, next) => {
  const files = req.files || [];
  const { params = {}, data: actual } = req;
  let uploaded = [];

  try {
    if (files.length === 0) {
      throw httpError("Envía al menos una imagen (campo: images)", 400);
    }
    if (actual.images.length + files.length > 12) {
      throw httpError("Máximo 12 fotos por producto", 400);
    }

    uploaded = await uploadAll(files);
    const desde = actual.images.reduce((max, i) => Math.max(max, i.orden), -1) + 1;

    await prisma.image.createMany({
      data: toImageData(uploaded, desde).map((i) => ({
        ...i,
        productId: params.id,
      })),
    });

    const result = await prisma.product.findUnique({
      where: { id: params.id },
      include,
    });
    res.status(201);
    res.json({
      data: serialize(result),
      message: `${uploaded.length} foto(s) agregada(s)`,
    });
  } catch (error) {
    await Promise.all(uploaded.map((u) => deleteFile(u.public_id)));
    next(error);
  } finally {
    cleanTemp(files);
  }
};

// Marca una foto como principal (orden 0) y corre las demás
export const setPrincipal = async (req, res, next) => {
  const { params = {}, data: actual } = req;
  const image = actual.images.find((i) => i.id === params.imageId);
  if (!image) return next({ message: "Imagen no encontrada", status: 404 });

  try {
    const ordenadas = [image, ...actual.images.filter((i) => i.id !== image.id)];
    await prisma.$transaction(
      ordenadas.map((img, orden) =>
        prisma.image.update({ where: { id: img.id }, data: { orden } }),
      ),
    );
    const result = await prisma.product.findUnique({
      where: { id: params.id },
      include,
    });
    res.json({ data: serialize(result), message: "Foto principal actualizada" });
  } catch (error) {
    next(error);
  }
};

export const removeImage = async (req, res, next) => {
  const { params = {}, data: actual } = req;
  const image = actual.images.find((i) => i.id === params.imageId);
  if (!image) return next({ message: "Imagen no encontrada", status: 404 });

  try {
    await prisma.image.delete({ where: { id: image.id } });
    await deleteFile(image.publicId);
    res.status(204);
    res.end();
  } catch (error) {
    next(error);
  }
};
