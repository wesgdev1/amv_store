// Reglas de negocio de productos (gorras y calzado)

export const CATEGORIAS = ["gorras", "zapatos"];
export const ETIQUETAS = ["NUEVO", "BAJO PEDIDO", "PROMOCION"];
export const PROMO = "PROMOCION";

// Gorras: CERRADA (fitted, con medidas) o BROCHE (ajustable, talla única, sin tallas)
export const TIPOS_GORRA = ["CERRADA", "BROCHE"];
export const BROCHE = "BROCHE";

// Gorras cerradas (fitted): solo estas 3 medidas. cm = contorno de cabeza
export const TALLAS_GORRA = [
  { label: "7 1/8", cm: 56.8 },
  { label: "7 1/4", cm: 57.7 },
  { label: "7 3/8", cm: 58.7 },
];

// Calzado: talla EU -> largo del pie en cm (se usa si el admin no envía cm)
export const TALLAS_CALZADO = [
  { label: "35", cm: 22.5 },
  { label: "36", cm: 23 },
  { label: "37", cm: 23.5 },
  { label: "38", cm: 24 },
  { label: "39", cm: 24.5 },
  { label: "40", cm: 25 },
  { label: "41", cm: 26 },
  { label: "42", cm: 27 },
  { label: "43", cm: 28 },
  { label: "44", cm: 29 },
  { label: "45", cm: 29.5 },
  { label: "46", cm: 30 },
];

// Relaciones que siempre se devuelven con el producto
export const include = {
  images: { orderBy: [{ orden: "asc" }, { createdAt: "asc" }] },
  tallas: { orderBy: { orden: "asc" } },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUUID = (value) => UUID_RE.test(String(value));

export const httpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const slugify = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const toBool = (value) => value === true || value === "true" || value === "1";

// Los campos llegan como texto cuando el body es multipart/form-data
const parseJSON = (value, campo) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    throw httpError(`El campo "${campo}" debe ser JSON válido`, 400);
  }
};

/**
 * Normaliza y valida las tallas según la categoría.
 * Acepta ["7 1/4", ...] o [{ label, cm?, disponible? }, ...]
 * - gorras cerradas: si no se envían, se crean las 3 medidas.
 * - gorras de broche: no llevan tallas (siempre []).
 * - zapatos: obligatorias.
 */
export const normalizeTallas = (categoria, input, tipo = null) => {
  if (categoria === "gorras" && tipo === BROCHE) return [];
  let tallas = parseJSON(input, "tallas");

  if (tallas === undefined || tallas === null || tallas === "") {
    if (categoria === "gorras") tallas = TALLAS_GORRA.map((t) => t.label);
    else throw httpError("Debes enviar las tallas del calzado", 400);
  }
  if (!Array.isArray(tallas) || tallas.length === 0) {
    throw httpError("tallas debe ser una lista con al menos una talla", 400);
  }

  const vistas = new Set();
  const result = tallas.map((t) => {
    const item = typeof t === "object" && t !== null ? t : { label: t };
    const label = String(item.label ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const disponible =
      item.disponible === undefined ? true : toBool(item.disponible);

    if (!label) throw httpError("Hay una talla sin label", 400);
    if (vistas.has(label)) throw httpError(`Talla repetida: ${label}`, 400);
    vistas.add(label);

    if (categoria === "gorras") {
      const ref = TALLAS_GORRA.find((g) => g.label === label);
      if (!ref) {
        throw httpError(
          `Talla de gorra inválida "${label}". Usa: ${TALLAS_GORRA.map(
            (g) => g.label,
          ).join(", ")}`,
          400,
        );
      }
      return { label, cm: ref.cm, disponible };
    }

    // zapatos
    if (!/^\d{2}(\.5)?$/.test(label)) {
      throw httpError(`Talla de calzado inválida "${label}" (ej: 42)`, 400);
    }
    const ref = TALLAS_CALZADO.find((z) => z.label === label);
    const cm = item.cm !== undefined && item.cm !== "" ? Number(item.cm) : ref?.cm;
    if (!cm || Number.isNaN(cm) || cm < 15 || cm > 35) {
      throw httpError(`Envía el largo en cm para la talla ${label}`, 400);
    }
    return { label, cm, disponible };
  });

  // Orden natural: 7 1/8 < 7 1/4 < 7 3/8 · 38 < 39 < 40
  const valor = (label) =>
    categoria === "gorras"
      ? TALLAS_GORRA.findIndex((g) => g.label === label)
      : Number(label);
  return result
    .sort((a, b) => valor(a.label) - valor(b.label))
    .map((t, orden) => ({ ...t, orden }));
};

/**
 * Valida y limpia los campos del producto (whitelist).
 * partial = true en updates: solo valida lo que llega.
 */
export const parseProductBody = (body = {}, { partial = false } = {}) => {
  const data = {};
  const has = (key) => body[key] !== undefined;

  if (!partial || has("nombre")) {
    const nombre = String(body.nombre ?? "").trim();
    if (nombre.length < 2) throw httpError("El nombre es obligatorio", 400);
    data.nombre = nombre.slice(0, 120);
  }

  if (!partial || has("categoria")) {
    const categoria = String(body.categoria ?? "")
      .trim()
      .toLowerCase();
    if (!CATEGORIAS.includes(categoria)) {
      throw httpError(`categoria debe ser: ${CATEGORIAS.join(" o ")}`, 400);
    }
    data.categoria = categoria;
  }

  if (!partial || has("precioUSD")) {
    const precio = Number(body.precioUSD);
    if (Number.isNaN(precio) || precio <= 0) {
      throw httpError("precioUSD debe ser un número mayor a 0", 400);
    }
    data.precioUSD = Math.round(precio * 100) / 100;
  }

  if (has("descripcion")) {
    data.descripcion = String(body.descripcion).trim().slice(0, 2000) || null;
  }

  if (has("precioAnteriorUSD")) {
    const anterior = body.precioAnteriorUSD;
    if (anterior === null || anterior === "") {
      data.precioAnteriorUSD = null;
    } else {
      const n = Number(anterior);
      if (Number.isNaN(n) || n <= 0) {
        throw httpError("precioAnteriorUSD debe ser un número mayor a 0", 400);
      }
      data.precioAnteriorUSD = Math.round(n * 100) / 100;
    }
  }

  if (has("etiqueta")) {
    // "Promoción" / "PROMOCIÓN" / "promocion" => "PROMOCION"
    const etiqueta = String(body.etiqueta ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toUpperCase();
    if (etiqueta && !ETIQUETAS.includes(etiqueta)) {
      throw httpError(`etiqueta debe ser: ${ETIQUETAS.join(", ")} o vacía`, 400);
    }
    data.etiqueta = etiqueta || null;
  }

  if (has("tipo")) {
    const tipo = String(body.tipo ?? "")
      .trim()
      .toUpperCase();
    if (tipo && !TIPOS_GORRA.includes(tipo)) {
      throw httpError(`tipo debe ser: ${TIPOS_GORRA.join(" o ")}`, 400);
    }
    data.tipo = tipo || null;
  }

  if (has("destacado")) data.destacado = toBool(body.destacado);
  if (has("activo")) data.activo = toBool(body.activo);

  return data;
};

/**
 * Regla de promoción (con el estado final = cambios + lo que ya había):
 * - etiqueta PROMOCION => precioAnteriorUSD obligatorio y mayor que precioUSD
 * - otra etiqueta      => precioAnteriorUSD se limpia
 */
export const applyPromo = (data, actual = {}) => {
  const etiqueta = data.etiqueta !== undefined ? data.etiqueta : actual.etiqueta;

  if (etiqueta !== PROMO) {
    if (actual.precioAnteriorUSD || data.precioAnteriorUSD !== undefined) {
      data.precioAnteriorUSD = null;
    }
    return data;
  }

  const precio = data.precioUSD ?? actual.precioUSD;
  const anterior =
    data.precioAnteriorUSD !== undefined
      ? data.precioAnteriorUSD
      : actual.precioAnteriorUSD;
  if (!anterior || anterior <= precio) {
    throw httpError(
      "En PROMOCIÓN el precio anterior debe ser mayor al precio de oferta",
      400,
    );
  }
  return data;
};

/**
 * Tipo final según la categoría (cambios + lo que ya había):
 * - gorras  => CERRADA (por defecto) o BROCHE
 * - zapatos => null
 */
export const applyTipo = (data, actual = {}) => {
  const categoria = data.categoria ?? actual.categoria;
  const tipo = data.tipo !== undefined ? data.tipo : actual.tipo;
  const final = categoria === "gorras" ? tipo || "CERRADA" : null;
  if (final !== (actual.tipo ?? null) || data.tipo !== undefined) {
    data.tipo = final;
  }
  return data;
};

const descuento = (p) =>
  p.etiqueta === PROMO && p.precioAnteriorUSD > p.precioUSD
    ? Math.round((1 - p.precioUSD / p.precioAnteriorUSD) * 100)
    : null;

// Forma que consume el front (web/js): imagen principal + lista
export const serialize = (product) => ({
  id: product.id,
  slug: product.slug,
  nombre: product.nombre,
  categoria: product.categoria,
  tipo: product.categoria === "gorras" ? product.tipo || "CERRADA" : null,
  descripcion: product.descripcion || "",
  precioUSD: product.precioUSD,
  precioAnteriorUSD: product.precioAnteriorUSD,
  descuento: descuento(product), // % (solo en promoción)
  destacado: product.destacado,
  etiqueta: product.etiqueta,
  activo: product.activo,
  imagen: product.images?.[0]?.url || null,
  imagenes: (product.images || []).map((i) => ({
    id: i.id,
    url: i.url,
    bytes: i.bytes,
    orden: i.orden,
  })),
  tallas: (product.tallas || []).map((t) => ({
    id: t.id,
    label: t.label,
    cm: t.cm,
    disponible: t.disponible,
  })),
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});
