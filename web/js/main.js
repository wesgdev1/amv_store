/* ==========================================================================
   AMV STORE — Página de inicio
   ========================================================================== */
import { CONFIG, instagramURL, mapsURL } from './config.js';
import { PRODUCTS } from './products.js';
import { initShell, productCard, watchImages, observeReveal, icon, esc } from './ui.js';

initShell();

/* ---------- Promociones ---------- */
const promos = PRODUCTS.filter((p) => p.etiqueta === 'PROMOCION');
const promoGrid = document.getElementById('promo-grid');
if (promos.length) {
  document.getElementById('promociones').hidden = false;
  promoGrid.innerHTML = promos.map(productCard).join('');
  watchImages(promoGrid);
}

/* ---------- Destacados ---------- */
const featured = document.getElementById('featured-grid');
featured.innerHTML = PRODUCTS.filter((p) => p.destacado).map(productCard).join('');

/* ---------- Catálogo con filtro ---------- */
const grid = document.getElementById('catalog-grid');
const filterBtns = [...document.querySelectorAll('[data-filter]')];
const FILTERS = ['todos', 'gorras', 'zapatos'];

// Contadores en los chips
filterBtns.forEach((b) => {
  const f = b.dataset.filter;
  const n = f === 'todos' ? PRODUCTS.length : PRODUCTS.filter((p) => p.categoria === f).length;
  b.querySelector('[data-n]').textContent = n;
});

function setFilter(filter, { updateURL = true } = {}) {
  if (!FILTERS.includes(filter)) filter = 'todos';
  filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  const list = filter === 'todos' ? PRODUCTS : PRODUCTS.filter((p) => p.categoria === filter);
  grid.innerHTML = list.length
    ? list.map(productCard).join('')
    : `<div class="empty" style="grid-column:1/-1">
        <h3 class="empty__title">Pronto nuevos drops</h3>
        <p class="empty__text">Estamos cargando la colección. Escríbenos por WhatsApp y te mostramos lo disponible.</p>
      </div>`;
  watchImages(grid);
  observeReveal(grid);
  if (updateURL) {
    const url = new URL(location.href);
    filter === 'todos' ? url.searchParams.delete('cat') : url.searchParams.set('cat', filter);
    history.replaceState(null, '', url);
  }
}

filterBtns.forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.filter)));

// Enlaces del navbar/footer a categorías: filtrar sin recargar
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href*="?cat="]');
  if (!a) return;
  const url = new URL(a.href);
  const norm = (p) => p.replace(/index\.html$/, '');
  if (norm(url.pathname) !== norm(location.pathname)) return;
  e.preventDefault();
  setFilter(url.searchParams.get('cat'));
  document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
});

setFilter(new URLSearchParams(location.search).get('cat') || 'todos', { updateURL: false });

/* ---------- Sedes ---------- */
document.getElementById('sedes-grid').innerHTML = CONFIG.sedes
  .map(
    (s, i) => `
  <article class="sede reveal">
    <span class="sede__num">0${i + 1}</span>
    <p class="sede__pais">${esc(s.pais)}</p>
    <h3 class="sede__city">${esc(s.ciudad)}</h3>
    <p class="sede__addr">${icon.pin}<span><strong>${esc(s.lugar)}</strong><br>${esc(s.detalle)}</span></p>
    <a class="btn btn--ghost btn--sm" href="${mapsURL(s)}" target="_blank" rel="noopener">Cómo llegar ${icon.arrow}</a>
  </article>`
  )
  .join('');

document.querySelectorAll('[data-instagram]').forEach((a) => {
  a.href = instagramURL();
  a.querySelector('[data-ig-handle]').textContent = '@' + CONFIG.instagram;
});

observeReveal();
watchImages(featured);
