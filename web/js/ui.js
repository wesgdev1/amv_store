/* ==========================================================================
   AMV STORE — UI compartida (todas las páginas)
   Drawer del carrito, toast, contador, selector rápido de talla, footer,
   botón flotante de WhatsApp, reveal al hacer scroll y card de producto.
   ========================================================================== */
import { CONFIG, TASA_BS, cld, formatBs, priceParts, waLink, instagramURL, mapsURL } from './config.js';
import { PRODUCTS, getProductById, tallaTexto, esBroche } from './products.js';

const hayPromos = () => PRODUCTS.some((p) => p.etiqueta === 'PROMOCION');
import * as cart from './cart.js';

/* ---------- Utilidades ---------- */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const productURL = (p) => `producto.html?slug=${encodeURIComponent(p.slug)}`;

const CATEGORIA_SINGULAR = { gorras: 'Gorra', zapatos: 'Calzado' };

/* ---------- Iconos (SVG inline, sin dependencias) ---------- */
export const icon = {
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" class="icon-fill"><path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.2 21.8l4.9-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

/* ---------- Imágenes: skeleton hasta que cargan ---------- */
export function watchImages(root = document) {
  root.querySelectorAll('.media img').forEach((img) => {
    const box = img.closest('.media');
    const done = () => box.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => box.classList.add('is-loaded', 'is-error'), { once: true });
    }
  });
}

/* ---------- Reveal con IntersectionObserver ---------- */
let revealIO;
export function observeReveal(root = document) {
  const els = root.querySelectorAll('.reveal:not(.is-visible)');
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  revealIO ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          revealIO.unobserve(e.target);
        }
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  els.forEach((el, i) => {
    el.style.setProperty('--d', `${(i % 4) * 70}ms`); // escalonado suave
    revealIO.observe(el);
  });
}

/* ---------- Card de producto ---------- */
function badge(etiqueta, descuento = null) {
  if (!etiqueta) return '';
  if (etiqueta === 'PROMOCION') {
    return `<span class="badge badge--promo">${descuento ? `Promo -${descuento}%` : 'Promoción'}</span>`;
  }
  const mod = etiqueta === 'NUEVO' ? 'nuevo' : 'pedido';
  return `<span class="badge badge--${mod}">${esc(etiqueta)}</span>`;
}

/** Texto de la tasa: "870,00 Bs por $1" */
export const tasaTexto = () => (TASA_BS > 0 ? `${formatBs(TASA_BS)} por $1` : 'no disponible');

/** Precio: Bs grande, USD de referencia. En promoción, el precio anterior tachado arriba. */
export function priceHTML(usd, size = '', anteriorUSD = null) {
  const { main, sub } = priceParts(usd);
  const old = anteriorUSD > usd ? `<s class="price__old" aria-label="Antes">${priceParts(anteriorUSD).main}</s>` : '';
  return `<div class="price ${size}">${old}<span class="price__main">${main}</span>${sub ? `<span class="price__sub">${sub}</span>` : ''}</div>`;
}

/* ---------- Carrusel de fotos (tarjetas y detalle) ----------
   Swipe nativo con scroll-snap; flechas en escritorio; puntos + contador "1/3". */
const CHEVRON = (d) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

/** URLs de las fotos del producto (la principal primero) */
export const fotosDe = (p) => {
  const urls = (p.imagenes || []).map((i) => i.url).filter(Boolean);
  return urls.length ? urls : [p.imagen].filter(Boolean);
};

/** Flechas, puntos y contador (solo si hay más de una foto) */
export function slidesNavHTML(n) {
  if (n < 2) return '';
  const dots = Array.from({ length: n }, (_, i) => `<span class="${i ? '' : 'is-active'}"></span>`).join('');
  return `
    <button class="slides__btn slides__btn--prev" type="button" data-slide-step="-1" aria-label="Foto anterior">${CHEVRON('M15 5l-7 7 7 7')}</button>
    <button class="slides__btn slides__btn--next" type="button" data-slide-step="1" aria-label="Foto siguiente">${CHEVRON('M9 5l7 7-7 7')}</button>
    <div class="slides__dots" aria-hidden="true">${dots}</div>
    <span class="slides__count" data-slide-count>1/${n}</span>`;
}

function goToSlide(root, index) {
  const track = root.querySelector('.slides__track');
  if (!track) return;
  const n = track.children.length;
  const i = (index + n) % n; // al final vuelve a la primera
  track.scrollTo({ left: i * track.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function syncSlides(track) {
  const root = track.closest('[data-slides]');
  if (!root) return;
  const n = track.children.length;
  const i = Math.min(n - 1, Math.max(0, Math.round(track.scrollLeft / (track.clientWidth || 1))));
  if (root.dataset.index === String(i)) return;
  root.dataset.index = i;
  // puntos y miniaturas: se marca el que tenga la misma posición en su grupo
  root.querySelectorAll('.slides__dots span, [data-slide-to]').forEach((el) => {
    el.classList.toggle('is-active', Array.prototype.indexOf.call(el.parentElement.children, el) === i);
  });
  const count = root.querySelector('[data-slide-count]');
  if (count) count.textContent = `${i + 1}/${n}`;
}

// Delegación global: sirve también para tarjetas que se pintan después (filtros, relacionados)
document.addEventListener(
  'scroll',
  (e) => {
    if (e.target instanceof Element && e.target.classList.contains('slides__track')) syncSlides(e.target);
  },
  true
);
document.addEventListener('click', (e) => {
  const btn = e.target.closest?.('[data-slide-step], [data-slide-to]');
  if (!btn) return;
  const root = btn.closest('[data-slides]');
  if (!root) return;
  e.preventDefault();
  const actual = Number(root.dataset.index || 0);
  goToSlide(root, btn.dataset.slideTo !== undefined ? Number(btn.dataset.slideTo) : actual + Number(btn.dataset.slideStep));
});

export function productCard(p) {
  const url = productURL(p);
  const fotos = fotosDe(p);
  const alt = `${esc(p.nombre)} — ${CATEGORIA_SINGULAR[p.categoria].toLowerCase()} AMV STORE`;
  const slides = fotos
    .map(
      (src, i) => `
        <a class="slides__slide" href="${url}" tabindex="-1" aria-hidden="true">
          <img src="${cld(src, 800)}"
               srcset="${cld(src, 400)} 400w, ${cld(src, 800)} 800w"
               sizes="(min-width: 1100px) 270px, (min-width: 720px) 33vw, 50vw"
               width="800" height="1067" loading="lazy" decoding="async"
               alt="${alt}${i ? ` (foto ${i + 1})` : ''}">
        </a>`
    )
    .join('');
  return `
  <article class="card reveal" data-categoria="${p.categoria}">
    <div class="card__media media slides" data-slides>
      <div class="slides__track">${slides}
      </div>
      ${badge(p.etiqueta, p.descuento)}
      ${slidesNavHTML(fotos.length)}
    </div>
    <div class="card__body">
      <p class="card__cat">${CATEGORIA_SINGULAR[p.categoria]}${esBroche(p) ? ' de broche' : ''}</p>
      <h3 class="card__title"><a href="${url}">${esc(p.nombre)}</a></h3>
      ${priceHTML(p.precioUSD, '', p.precioAnteriorUSD)}
      <div class="card__actions">
        <a class="btn btn--ghost btn--sm" href="${url}">Ver detalle</a>
        <button class="btn btn--primary btn--sm btn--add" type="button" data-quick-add="${p.id}" aria-label="Agregar ${esc(p.nombre)} al carrito">
          ${icon.bag}<span>Agregar</span>
        </button>
      </div>
    </div>
  </article>`;
}

export { badge };

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('is-show');
  void el.offsetWidth; // reinicia la animación
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 2400);
}

/** Agregar + feedback (toast). Úsalo desde cualquier página. */
export function addToCart(product, tallaLabel, qty = 1) {
  cart.addItem(product.id, tallaLabel, qty);
  toast('Agregado al carrito ✓');
}

/* ---------- Contador del navbar ---------- */
function updateCount(animate = true) {
  const n = cart.getCount();
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    const prev = Number(el.textContent) || 0;
    el.textContent = n;
    el.hidden = n === 0;
    if (animate && n > prev) {
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
    }
  });
  document.querySelectorAll('[data-cart-open]').forEach((b) =>
    b.setAttribute('aria-label', `Abrir carrito, ${n} ${n === 1 ? 'producto' : 'productos'}`)
  );
}

/* ---------- Drawer del carrito ---------- */
let lastFocus = null;
const $drawer = () => document.getElementById('cart-drawer');

export function openCart() {
  const d = $drawer();
  lastFocus = document.activeElement;
  d.hidden = false;
  requestAnimationFrame(() => d.classList.add('is-open'));
  document.body.classList.add('no-scroll');
  d.querySelector('.drawer__close').focus();
}

export function closeCart() {
  const d = $drawer();
  if (d.hidden) return;
  d.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
  const end = () => (d.hidden = true);
  reducedMotion() ? end() : setTimeout(end, 320);
  lastFocus?.focus?.();
}

function renderCart() {
  const d = $drawer();
  const items = cart.getItems();
  const count = cart.getCount();
  d.querySelector('[data-drawer-count]').textContent = count ? `(${count})` : '';

  const body = d.querySelector('.drawer__body');
  const foot = d.querySelector('.drawer__foot');

  if (!items.length) {
    body.innerHTML = `
      <div class="empty">
        <div class="empty__ring">${icon.bag}</div>
        <p class="empty__title">Tu carrito está vacío</p>
        <p class="empty__text">Las gorras y los pares que te gustan te están esperando.</p>
        <a class="btn btn--primary" href="index.html#catalogo" data-cart-close>Ver colección</a>
      </div>`;
    foot.hidden = true;
    return;
  }

  body.innerHTML = `<ul class="cart-list">${items
    .map(
      (i) => `
    <li class="cart-item">
      <a class="cart-item__img media" href="${productURL(i.product)}">
        <img src="${cld(i.product.imagen, 200)}" width="200" height="267" alt="${esc(i.product.nombre)}">
      </a>
      <div class="cart-item__info">
        <a class="cart-item__name" href="${productURL(i.product)}">${esc(i.product.nombre)}</a>
        <p class="cart-item__meta">Talla: ${esc(tallaTexto(i.talla, i.product.categoria))}</p>
        <div class="cart-item__row">
          <div class="qty qty--sm" role="group" aria-label="Cantidad de ${esc(i.product.nombre)}">
            <button type="button" data-action="dec" data-key="${i.key}" aria-label="Restar uno">${icon.minus}</button>
            <span aria-live="polite">${i.qty}</span>
            <button type="button" data-action="inc" data-key="${i.key}" aria-label="Sumar uno">${icon.plus}</button>
          </div>
          <div class="cart-item__price">
            <strong>${priceParts(i.subtotalUSD).main}</strong>
            <small>${priceParts(i.subtotalUSD).sub}</small>
          </div>
        </div>
      </div>
      <button class="cart-item__remove" type="button" data-action="remove" data-key="${i.key}" aria-label="Eliminar ${esc(i.product.nombre)} del carrito">${icon.trash}</button>
    </li>`
    )
    .join('')}</ul>`;
  watchImages(body);

  const total = cart.getTotal();
  foot.hidden = false;
  const tp = priceParts(total.usd);
  foot.querySelector('[data-total-usd]').textContent = tp.main;
  foot.querySelector('[data-total-bs]').textContent = tp.sub;
  foot.querySelector('[data-checkout]').href = cart.checkoutURL();
}

function drawerTemplate() {
  return `
  <div class="drawer" id="cart-drawer" hidden>
    <div class="drawer__overlay" data-cart-close></div>
    <aside class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header class="drawer__head">
        <h2 id="drawer-title">Tu carrito <span data-drawer-count></span></h2>
        <button class="icon-btn drawer__close" type="button" data-cart-close aria-label="Cerrar carrito">${icon.close}</button>
      </header>
      <div class="drawer__body"></div>
      <footer class="drawer__foot" hidden>
        <div class="drawer__total">
          <span>Total</span>
          <div><strong data-total-usd></strong><small data-total-bs></small></div>
        </div>
        <a class="btn btn--primary btn--block btn--wa" data-checkout href="#" target="_blank" rel="noopener">
          ${icon.whatsapp} Finalizar compra por WhatsApp
        </a>
        <button class="btn btn--text" type="button" data-clear>Vaciar carrito</button>
        <p class="drawer__note">Coordinamos pago y entrega por WhatsApp. Tasa del día: ${tasaTexto()}.</p>
      </footer>
    </aside>
  </div>`;
}

function bindDrawer() {
  const d = $drawer();

  d.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const key = btn.dataset.key;
      const item = cart.getItems().find((i) => i.key === key);
      if (btn.dataset.action === 'inc' && item) cart.setQty(key, item.qty + 1);
      if (btn.dataset.action === 'dec' && item) cart.setQty(key, item.qty - 1);
      if (btn.dataset.action === 'remove') cart.removeItem(key);
      // conserva el foco en el control equivalente tras re-render
      const again = d.querySelector(`[data-action="${btn.dataset.action}"][data-key="${CSS.escape(key)}"]`);
      (again || d.querySelector('.drawer__close')).focus();
      return;
    }
    // Vaciar con confirmación en dos toques (sin window.confirm)
    const clear = e.target.closest('[data-clear]');
    if (clear) {
      if (clear.dataset.armed) {
        cart.clearCart();
        d.querySelector('.drawer__close').focus();
      } else {
        clear.dataset.armed = '1';
        clear.textContent = '¿Seguro? Toca otra vez para vaciar';
        setTimeout(() => {
          delete clear.dataset.armed;
          clear.textContent = 'Vaciar carrito';
        }, 3000);
      }
    }
  });

  // Trampa de foco simple dentro del panel
  d.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...d.querySelectorAll('a[href], button:not([disabled])')].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/* ---------- Selector rápido de talla (bottom sheet con <dialog>) ---------- */
function sizeSheetTemplate() {
  return `
  <dialog class="sheet" id="size-sheet" aria-labelledby="sheet-title">
    <form method="dialog" class="sheet__inner">
      <button class="icon-btn sheet__close" value="cancel" aria-label="Cerrar">${icon.close}</button>
      <div class="sheet__product"></div>
      <fieldset class="sizes">
        <legend>Elige tu talla</legend>
        <div class="sizes__grid"></div>
      </fieldset>
      <p class="field-error" role="alert" hidden>Selecciona una talla para continuar.</p>
      <button class="btn btn--primary btn--block" value="add" type="submit" data-sheet-add>${icon.bag} Agregar al carrito</button>
      <a class="btn btn--text" data-sheet-detail href="#">Ver detalle completo</a>
    </form>
  </dialog>`;
}

export function sizeOptionsHTML(p, name) {
  const calzado = p.categoria === 'zapatos';
  return p.tallas
    .map((t) => {
      // Calzado: grande "27 cm", chico "EU 42" · Gorra: grande "7 1/4", chico "57.7 cm"
      const main = calzado && t.cm ? `${t.cm} cm` : esc(t.label);
      const sub = calzado ? `EU ${esc(t.label)}` : t.cm ? `${t.cm} cm` : '';
      return `
    <label class="size">
      <input type="radio" name="${name}" value="${esc(t.label)}" ${p.tallas.length === 1 ? 'checked' : ''}>
      <span><b>${main}</b><small>${sub}</small></span>
    </label>`;
    })
    .join('');
}

function openSizeSheet(p) {
  const dlg = document.getElementById('size-sheet');
  if (typeof dlg.showModal !== 'function') {
    location.href = productURL(p); // navegador sin <dialog>: ir al detalle
    return;
  }
  dlg.dataset.id = p.id;
  dlg.querySelector('.sheet__product').innerHTML = `
    <div class="media sheet__img"><img src="${cld(p.imagen, 200)}" width="200" height="267" alt="${esc(p.nombre)}"></div>
    <div>
      <h2 id="sheet-title" class="sheet__title">${esc(p.nombre)}</h2>
      ${priceHTML(p.precioUSD, '', p.precioAnteriorUSD)}
    </div>`;
  dlg.querySelector('.sizes__grid').innerHTML = sizeOptionsHTML(p, 'sheet-size');
  dlg.querySelector('.field-error').hidden = true;
  dlg.querySelector('[data-sheet-detail]').href = productURL(p);
  watchImages(dlg);
  dlg.showModal();
}

function bindSizeSheet() {
  const dlg = document.getElementById('size-sheet');
  dlg.querySelector('form').addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'add') return; // "cerrar"
    const sel = dlg.querySelector('input[name="sheet-size"]:checked');
    if (!sel) {
      e.preventDefault();
      const err = dlg.querySelector('.field-error');
      err.hidden = false;
      dlg.querySelector('.sizes').classList.remove('shake');
      void dlg.offsetWidth;
      dlg.querySelector('.sizes').classList.add('shake');
      return;
    }
    addToCart(getProductById(dlg.dataset.id), sel.value);
  });
  // clic en el fondo cierra
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
}

/* ---------- Footer ---------- */
function footerHTML() {
  const year = new Date().getFullYear();
  return `
  <div class="container footer__grid">
    <div class="footer__brand">
      <img class="logo-round" src="${cld(CONFIG.logo, 160)}" width="72" height="72" loading="lazy" alt="Logo AMV STORE">
      <div>
        <p class="footer__name">${CONFIG.nombre}</p>
        <p class="footer__tag">${CONFIG.subtitulo} · ${CONFIG.lema}</p>
      </div>
    </div>
    <nav class="footer__col" aria-label="Tienda">
      <h3>Tienda</h3>
      <a href="index.html?cat=gorras#catalogo">Gorras</a>
      <a href="index.html?cat=zapatos#catalogo">Zapatos</a>
      ${hayPromos() ? '<a href="index.html#promociones">Promociones</a>' : ''}
      <a href="index.html#destacados">Destacados</a>
    </nav>
    <div class="footer__col">
      <h3>Tienda física</h3>
      ${CONFIG.sedes.map((s) => `<a href="${mapsURL(s)}" target="_blank" rel="noopener">${s.ciudad} · ${s.lugar}</a>`).join('')}
    </div>
    <div class="footer__col">
      <h3>Contacto</h3>
      <a href="${waLink()}" target="_blank" rel="noopener">${icon.whatsapp} ${CONFIG.whatsappDisplay}</a>
      <a href="${instagramURL()}" target="_blank" rel="noopener">${icon.instagram} @${CONFIG.instagram}</a>
    </div>
  </div>
  <div class="container footer__bottom">
    <p>© ${year} ${CONFIG.nombre}. Activos desde ${CONFIG.desde}. San Cristóbal, Táchira.</p>
    <p>Precios en Bs calculados a la tasa del día: ${tasaTexto()}.</p>
  </div>`;
}

/* ---------- Header: menú móvil + estado al hacer scroll ---------- */
function bindHeader() {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.getElementById('main-nav');

  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (!toggle || !nav) return;
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => e.target.closest('a') && setOpen(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
}

/* ---------- Init de la “carcasa” común ---------- */
export function initShell() {
  document.documentElement.classList.add('js');

  document.body.insertAdjacentHTML(
    'beforeend',
    `${drawerTemplate()}
     ${sizeSheetTemplate()}
     <div class="toast" id="toast" role="status" aria-live="polite"></div>
     <a class="wa-float" href="${waLink(`Hola ${CONFIG.nombre}, quiero información.`)}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">${icon.whatsapp}</a>`
  );

  const footer = document.getElementById('site-footer');
  if (footer) footer.innerHTML = footerHTML();

  if (hayPromos()) document.querySelectorAll('[data-promo-link]').forEach((a) => (a.hidden = false));

  // Enlaces de WhatsApp declarados en el HTML: <a data-wa="mensaje">
  document.querySelectorAll('[data-wa]').forEach((a) => (a.href = waLink(a.dataset.wa)));

  bindHeader();
  bindDrawer();
  bindSizeSheet();

  // Delegación global: abrir/cerrar carrito y "Agregar" rápido
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-open]')) {
      e.preventDefault();
      openCart();
      return;
    }
    if (e.target.closest('[data-cart-close]')) {
      closeCart();
      return;
    }
    const quick = e.target.closest('[data-quick-add]');
    if (quick) {
      const p = getProductById(quick.dataset.quickAdd);
      if (!p) return;
      if (p.tallas.length === 1) addToCart(p, p.tallas[0].label);
      else openSizeSheet(p);
    }
  });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && closeCart());

  cart.subscribe(() => {
    updateCount();
    renderCart();
  });
  updateCount(false);
  renderCart();
  watchImages();
  observeReveal();
}
