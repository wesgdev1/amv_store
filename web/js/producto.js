/* ==========================================================================
   AMV STORE — Detalle de producto (producto.html?slug=...)
   ========================================================================== */
import { CONFIG, cld, priceText, waLink } from './config.js';
import { getProductBySlug, getRelated } from './products.js';
import { initShell, productCard, watchImages, observeReveal, addToCart, sizeOptionsHTML, badge, priceHTML, icon, esc } from './ui.js';

initShell();

const root = document.getElementById('product-root');
const slug = new URLSearchParams(location.search).get('slug');
const product = slug && getProductBySlug(slug);

if (!product) renderNotFound();
else renderProduct(product);

function renderNotFound() {
  document.title = `Producto no encontrado | ${CONFIG.nombre}`;
  root.innerHTML = `
    <section class="container notfound">
      <div class="empty">
        <div class="empty__ring">?</div>
        <h1 class="empty__title">Este producto no existe</h1>
        <p class="empty__text">Puede que el enlace esté mal escrito o que el modelo ya no esté disponible.</p>
        <a class="btn btn--primary" href="index.html#catalogo">Volver al catálogo</a>
      </div>
    </section>`;
  document.getElementById('related').hidden = true;
}

function renderProduct(p) {
  const catLabel = p.categoria === 'gorras' ? 'Gorras' : 'Zapatos';

  // SEO dinámico
  document.title = `${p.nombre} | ${CONFIG.nombre}`;
  document.querySelector('meta[name="description"]').content = `${p.nombre} a ${priceText(p.precioUSD)}. ${p.descripcion}`;
  document.querySelector('meta[property="og:title"]').content = `${p.nombre} | ${CONFIG.nombre}`;
  document.querySelector('meta[property="og:image"]').content = cld(p.imagen, 1200);

  const esCalzado = p.categoria === 'zapatos';

  root.innerHTML = `
    <nav class="container crumbs" aria-label="Ruta">
      <a href="index.html">Inicio</a><span aria-hidden="true">/</span>
      <a href="index.html?cat=${p.categoria}#catalogo">${catLabel}</a><span aria-hidden="true">/</span>
      <span aria-current="page">${esc(p.nombre)}</span>
    </nav>

    <article class="container pdp">
      <div class="pdp__gallery">
        <div class="pdp__media media">
          <img src="${cld(p.imagen, 1200)}"
               srcset="${cld(p.imagen, 800)} 800w, ${cld(p.imagen, 1200)} 1200w"
               sizes="(min-width: 960px) 560px, 100vw"
               width="1200" height="1600" fetchpriority="high" decoding="async"
               alt="${esc(p.nombre)}, vista principal">
          ${badge(p.etiqueta, p.descuento)}
        </div>
      </div>

      <div class="pdp__info">
        <p class="eyebrow">${catLabel}</p>
        <h1 class="pdp__title">${esc(p.nombre)}</h1>
        ${priceHTML(p.precioUSD, 'price--lg', p.precioAnteriorUSD)}
        ${p.descuento ? `<p class="promo-note">Ahorras ${p.descuento}% · Precio de promoción por tiempo limitado</p>` : ''}
        <p class="pdp__desc">${esc(p.descripcion)}</p>

        <form class="pdp__form" novalidate>
          <fieldset class="sizes">
            <legend>${esCalzado ? 'Talla (largo del pie en cm)' : 'Talla (circunferencia de cabeza)'}</legend>
            <div class="sizes__grid">${sizeOptionsHTML(p, 'size')}</div>
          </fieldset>
          <p class="field-error" id="size-error" role="alert" hidden>Elige tu talla antes de agregar.</p>
          ${esCalzado ? '<p class="hint">Mide tu pie del talón a la punta del dedo más largo y elige la talla en cm más cercana.</p>' : '<p class="hint">Gorra cerrada (fitted). Mide el contorno de tu cabeza por encima de las cejas: 7 1/8 ≈ 56.8 cm · 7 1/4 ≈ 57.7 cm · 7 3/8 ≈ 58.7 cm.</p>'}

          <div class="pdp__buy">
            <div class="qty" role="group" aria-label="Cantidad">
              <button type="button" data-step="-1" aria-label="Restar uno">${icon.minus}</button>
              <input type="number" id="qty" name="qty" value="1" min="1" max="20" inputmode="numeric" aria-label="Cantidad">
              <button type="button" data-step="1" aria-label="Sumar uno">${icon.plus}</button>
            </div>
            <button class="btn btn--primary btn--grow" type="submit">${icon.bag} Agregar al carrito</button>
          </div>
        </form>

        <ul class="pdp__perks">
          <li>${icon.check} ${p.etiqueta === 'BAJO PEDIDO' ? 'Bajo pedido: te confirmamos tiempo de llegada por WhatsApp' : 'Disponible en tienda física'}</li>
          <li>${icon.check} Retiro en tienda (San Cristóbal) o envío coordinado</li>
          <li>${icon.check} <a href="${waLink(`Hola ${CONFIG.nombre}, tengo una pregunta sobre ${p.nombre}.`)}" target="_blank" rel="noopener">¿Dudas con la talla? Escríbenos</a></li>
        </ul>
      </div>
    </article>`;

  bindForm(p);
  watchImages(root);

  // Relacionados
  const relGrid = document.getElementById('related-grid');
  relGrid.innerHTML = getRelated(p).map(productCard).join('');
  watchImages(relGrid);
  observeReveal();
}

function bindForm(p) {
  const form = root.querySelector('.pdp__form');
  const qty = form.querySelector('#qty');
  const err = form.querySelector('#size-error');
  const sizes = form.querySelector('.sizes');

  const clampQty = () => (qty.value = Math.max(1, Math.min(20, parseInt(qty.value, 10) || 1)));

  form.querySelectorAll('[data-step]').forEach((b) =>
    b.addEventListener('click', () => {
      qty.value = (parseInt(qty.value, 10) || 1) + Number(b.dataset.step);
      clampQty();
    })
  );
  qty.addEventListener('change', clampQty);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'size') err.hidden = true;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const sel = form.querySelector('input[name="size"]:checked');
    if (!sel) {
      err.hidden = false;
      sizes.classList.remove('shake');
      void sizes.offsetWidth;
      sizes.classList.add('shake');
      sizes.querySelector('input').focus();
      return;
    }
    addToCart(p, sel.value, Number(clampQty()));
  });
}
