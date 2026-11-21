/* ==========================================================================
   AMV STORE — Configuración del negocio
   Cambia aquí: WhatsApp, Instagram, sedes. Todo el sitio lee de este archivo.
   ========================================================================== */

/** URL de la API. Relativa: el backend (carpeta /api) sirve este mismo front. */
export const API_URL = '/api/v1';

/**
 * Tasa del día (Bs por $1). Se administra en /admin → "Tasa del día".
 * Los precios se guardan en USD; el precio en Bs SIEMPRE se calcula con esta tasa,
 * así que al cambiarla se actualizan todos los precios en Bs.
 */
export let TASA_BS = 0;
export let TASA_FECHA = null;
export function setTasa(valor, fecha = null) {
  TASA_BS = Number(valor) || 0;
  TASA_FECHA = fecha;
}

try {
  const res = await fetch(`${API_URL}/tasa`, { headers: { Accept: 'application/json' } });
  const { data } = await res.json();
  if (data) setTasa(data.valor, data.createdAt);
} catch (err) {
  console.warn('[AMV] No se pudo cargar la tasa del día:', err);
}

export const CONFIG = {
  nombre: 'AMV STORE',
  subtitulo: 'Calzado Deportivo',
  lema: 'Calzado bajo pedido · Desde 2017',
  desde: 2017,

  // WhatsApp en formato internacional sin "+" ni espacios (Colombia +57)
  whatsapp: '573106668481',
  whatsappDisplay: '+57 310 666 8481',

  instagram: 'amv_store_',

  logo: 'https://res.cloudinary.com/v1tbindq/image/upload/v1793993572/WhatsApp_Image_2026-11-02_at_8.42.57_AM.jpg',
  banner: 'https://res.cloudinary.com/v1tbindq/image/upload/v1793994481/Banner_promocional_de_gorras_AMV_Store_en_lujo_oscuro.png',

  sedes: [
    {
      ciudad: 'San Cristóbal',
      pais: 'Táchira, Venezuela',
      lugar: 'CC Shopping Center 5ta Avenida',
      detalle: 'Planta baja, Local 05',
    },
  ],
};

/* ---------- Helpers de formato ---------- */

const round2 = (n) => Math.round(n * 100) / 100;

/** Precio en Bs SIEMPRE calculado: precioUSD × TASA_BS (tasa del día) */
export const usdToBs = (usd) => round2(usd * TASA_BS);

/** "$20.00" (miles con coma: "$1,250.00") */
export function formatUSD(n) {
  return '$' + round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formato venezolano: "20.000,00 Bs" (manual para no depender del ICU del navegador) */
export function formatBs(n) {
  const [ent, dec] = round2(n).toFixed(2).split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${miles},${dec} Bs`;
}

/** Inserta transformaciones de Cloudinary después de /upload/ */
export function cld(url, width) {
  if (!url) return '';
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
}

/**
 * Precio para mostrar: Bs primero (principal) y USD como referencia.
 * Si la tasa no cargó, se muestra solo el USD.
 */
export function priceParts(usd) {
  return TASA_BS > 0
    ? { main: formatBs(usdToBs(usd)), sub: formatUSD(usd) }
    : { main: formatUSD(usd), sub: '' };
}

/** "19.140,00 Bs ($22.00)" — para textos y mensajes */
export function priceText(usd) {
  const { main, sub } = priceParts(usd);
  return sub ? `${main} (${sub})` : main;
}

/**
 * Limpia el texto para WhatsApp: los emojis, guiones largos y comillas
 * tipográficas salen como "�" en WhatsApp Web/Escritorio. Las tildes y la ñ sí van bien.
 */
export function cleanWA(text) {
  return String(text)
    .normalize('NFC')
    .replace(/[\u2012-\u2015]/g, '-') // guiones largos
    .replace(/[\u2018\u2019\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00B7\u2022]/g, '-') // puntos medios
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/\p{Extended_Pictographic}|[\u{1F000}-\u{1FFFF}\u2600-\u27BF\uFE0F\u200D]/gu, '') // emojis y s\u00EDmbolos
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Enlace de WhatsApp con mensaje (api.whatsapp.com codifica mejor que wa.me) */
export function waLink(text = '') {
  const base = `https://api.whatsapp.com/send?phone=${CONFIG.whatsapp}`;
  return text ? `${base}&text=${encodeURIComponent(cleanWA(text))}` : base;
}

export const instagramURL = () => `https://instagram.com/${CONFIG.instagram}`;

export const mapsURL = (sede) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sede.lugar}, ${sede.ciudad}`)}`;
