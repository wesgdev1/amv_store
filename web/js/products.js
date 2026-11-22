/* ==========================================================================
   AMV STORE — Catálogo (desde la API)
   Los productos se administran en /admin. precioUSD es la única fuente de
   precio; el precio en Bs se calcula con TASA_BS.
   ========================================================================== */
import { API_URL } from './config.js';

/** Gorra de broche: ajustable, no lleva tallas */
export const esBroche = (p) => p.categoria === 'gorras' && p.tipo === 'BROCHE';
export const TALLA_BROCHE = 'Ajustable (broche)';

// Las gorras de broche llegan sin tallas: se les da una "talla única"
// para que el carrito, el selector y el mensaje de WhatsApp funcionen igual
const conTallaUnica = (p) =>
  esBroche(p) ? { ...p, tallas: [{ id: 'broche', label: TALLA_BROCHE, cm: null, disponible: true }] } : p;

async function loadProducts() {
  try {
    const res = await fetch(`${API_URL}/products`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data } = await res.json();
    return Array.isArray(data) ? data.map(conTallaUnica) : [];
  } catch (err) {
    console.warn('[AMV] No se pudo cargar el catálogo:', err);
    return [];
  }
}

// Top-level await: los módulos que importan PRODUCTS esperan a que cargue
export const PRODUCTS = await loadProducts();

export const getProductBySlug = (slug) => PRODUCTS.find((p) => p.slug === slug);
export const getProductById = (id) => PRODUCTS.find((p) => String(p.id) === String(id));

export const esCalzado = (categoria) => categoria === 'zapatos';

/** Texto legible de una talla: "27 cm (EU 42)" o "7 1/4 (57.7 cm)" */
export function tallaTexto(talla, categoria) {
  if (!talla.cm) return talla.label;
  return esCalzado(categoria) ? `${talla.cm} cm (EU ${talla.label})` : `${talla.label} (${talla.cm} cm)`;
}

/** Productos relacionados: misma categoría primero, luego el resto */
export function getRelated(product, limit = 4) {
  const others = PRODUCTS.filter((p) => p.id !== product.id);
  const same = others.filter((p) => p.categoria === product.categoria);
  const rest = others.filter((p) => p.categoria !== product.categoria);
  return [...same, ...rest].slice(0, limit);
}
