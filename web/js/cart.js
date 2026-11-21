/* ==========================================================================
   AMV STORE — Carrito
   Estado en un objeto, persistido en localStorage. Los precios NO se guardan:
   se leen del catálogo al calcular, así un cambio de precio o tasa se refleja solo.
   ========================================================================== */
import { CONFIG, usdToBs, priceText, waLink } from './config.js';
import { getProductById, tallaTexto } from './products.js';

const STORAGE_KEY = 'amv_cart_v1';
const MAX_QTY = 20;

const state = { items: [] }; // [{ id, talla, qty }]
const listeners = new Set();

export const itemKey = (id, talla) => `${id}::${talla}`;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    state.items = Array.isArray(data?.items)
      ? data.items.filter((i) => getProductById(i.id) && i.qty > 0)
      : [];
  } catch {
    state.items = [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items }));
  } catch {
    /* modo privado o almacenamiento lleno: el carrito sigue en memoria */
  }
}

function emit() {
  save();
  listeners.forEach((fn) => fn());
}

/** Suscribirse a cambios del carrito. Devuelve función para desuscribirse. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const find = (key) => state.items.find((i) => itemKey(i.id, i.talla) === key);
const clamp = (n) => Math.max(1, Math.min(MAX_QTY, Math.floor(n) || 1));

/* ---------- Acciones ---------- */

/** Mismo producto + misma talla suma cantidad; otra talla es otro ítem. */
export function addItem(id, talla, qty = 1) {
  const existing = find(itemKey(id, talla));
  if (existing) existing.qty = clamp(existing.qty + qty);
  else state.items.push({ id, talla, qty: clamp(qty) });
  emit();
}

export function removeItem(key) {
  state.items = state.items.filter((i) => itemKey(i.id, i.talla) !== key);
  emit();
}

export function setQty(key, qty) {
  const item = find(key);
  if (!item) return;
  if (qty < 1) return removeItem(key);
  item.qty = clamp(qty);
  emit();
}

export function clearCart() {
  state.items = [];
  emit();
}

/* ---------- Lecturas ---------- */

/** Ítems con datos del producto resueltos y subtotales calculados */
export function getItems() {
  return state.items
    .map((i) => {
      const product = getProductById(i.id);
      if (!product) return null;
      const talla = product.tallas.find((t) => t.label === i.talla) || { label: i.talla, cm: '' };
      const subtotalUSD = product.precioUSD * i.qty;
      return { key: itemKey(i.id, i.talla), product, talla, qty: i.qty, subtotalUSD, subtotalBs: usdToBs(subtotalUSD) };
    })
    .filter(Boolean);
}

export const getCount = () => state.items.reduce((n, i) => n + i.qty, 0);

export function getTotal() {
  const usd = getItems().reduce((sum, i) => sum + i.subtotalUSD, 0);
  return { usd, bs: usdToBs(usd) };
}

/* ---------- Checkout WhatsApp ---------- */

export function buildWhatsAppMessage() {
  const lines = getItems().map(
    (i, n) =>
      `${n + 1}) ${i.product.nombre}
   Talla: ${tallaTexto(i.talla, i.product.categoria)} | Cant: ${i.qty} | ${priceText(i.subtotalUSD)}`
  );
  const total = getTotal();
  return [
    `Hola ${CONFIG.nombre}, quiero hacer este pedido:`,
    '',
    ...lines,
    '',
    `*Total: ${priceText(total.usd)}*`,
    '',
    'Quedo atento para coordinar el pago y la entrega. ¡Gracias!',
  ].join('\n');
}

export const checkoutURL = () => waLink(buildWhatsAppMessage());

/* ---------- Init ---------- */
load();

// Sincroniza entre pestañas abiertas
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    load();
    listeners.forEach((fn) => fn());
  }
});
