/* ==========================================================================
   AMV STORE — Panel admin
   Login (solo administrador), CRUD de gorras y calzado, subida de fotos.
   Las fotos se comprimen en el navegador antes de subir y Cloudinary las
   vuelve a optimizar (WebP, máx 1200 px).
   ========================================================================== */
import { API_URL, TASA_BS, setTasa, cld, formatBs, priceParts } from '../js/config.js';

const TOKEN_KEY = 'amv_admin_token';
const MAX_FILES = 8;

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const ICON = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13 7 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  products: [],
  filter: 'todos',
  q: '',
  ref: null, // tallas permitidas desde la API
  editing: null, // producto en edición o null
  newFiles: [], // [{ file, url, original }]
};

/* ---------- API ---------- */

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });

  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/users/signin') {
    logout('Tu sesión expiró, vuelve a entrar');
  }
  if (!res.ok) throw new Error(json?.error?.message || `Error ${res.status}`);
  return json;
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 2800);
}

/* ---------- Compresión en el navegador ---------- */

const fmtKB = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

const toBlob = (canvas, type, quality) => new Promise((r) => canvas.toBlob(r, type, quality));

/** Reduce a máx 1600 px y recodifica en WebP (o JPEG si el navegador no soporta WebP) */
async function compressImage(file, max = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // formato no soportado por el navegador (ej. HEIC): Cloudinary lo convierte
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
  if (!blob || blob.size >= file.size) return file;

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: blob.type });
}

/* ---------- Sesión ---------- */

function showView(name) {
  $('#view-login').hidden = name !== 'login';
  $('#view-dash').hidden = name !== 'dash';
  $('[data-session]').hidden = name !== 'dash';
}

function logout(msg) {
  state.token = '';
  localStorage.removeItem(TOKEN_KEY);
  if ($('#editor').open) $('#editor').close();
  showView('login');
  if (msg) toast(msg);
}

async function boot() {
  if (!state.token) return showView('login');
  try {
    const { data } = await api('/users/me');
    $('[data-user-email]').textContent = data.email;
    showView('dash');
    await Promise.all([loadRef(), loadTasa(), loadProducts()]);
  } catch {
    logout();
  }
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const err = $('[data-login-error]');
  const btn = $('button[type="submit"]', form);
  err.hidden = true;
  btn.classList.add('is-loading');
  try {
    const { meta } = await api('/users/signin', {
      method: 'POST',
      body: { email: form.email.value, password: form.password.value },
    });
    state.token = meta.token;
    localStorage.setItem(TOKEN_KEY, meta.token);
    form.reset();
    await boot();
  } catch (error) {
    err.textContent = error.message;
    err.hidden = false;
  } finally {
    btn.classList.remove('is-loading');
  }
});

$('[data-logout]').addEventListener('click', () => logout('Sesión cerrada'));

/* ---------- Tasa del día ---------- */

const fmtFecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' }) : '';

function renderTasa(hist = []) {
  $('[data-tasa-valor]').textContent = TASA_BS > 0 ? formatBs(TASA_BS).replace(' Bs', '') : 'Sin tasa';
  $('[data-tasa-fecha]').textContent = hist[0] ? `Actualizada: ${fmtFecha(hist[0].createdAt)}` : 'Aún no hay tasa: cárgala para mostrar precios en Bs.';
  $('[data-tasa-hist]').innerHTML = hist.length
    ? hist.map((t) => `<li><span>${fmtFecha(t.createdAt)}</span><b>${formatBs(t.valor)}</b></li>`).join('')
    : '<li>Sin cambios registrados</li>';
}

async function loadTasa() {
  const { data } = await api('/tasa/historial?limit=10');
  if (data[0]) setTasa(data[0].valor, data[0].createdAt);
  renderTasa(data);
}

// "870" · "870,50" · "1.250,75" -> número
const parseTasa = (v) => {
  const t = String(v).trim();
  return Number(t.includes(',') ? t.replace(/./g, '').replace(',', '.') : t);
};

const TASA_HINT = 'Al guardar se actualizan todos los precios en Bs de la tienda.';

$('#tasa-form').valor.addEventListener('input', (e) => {
  const v = parseTasa(e.target.value);
  $('[data-tasa-preview]').textContent = v > 0 ? `Ejemplo: un producto de $22 quedará en ${formatBs(22 * v)}` : TASA_HINT;
});

$('#tasa-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const btn = $('button[type="submit"]', form);
  const valor = parseTasa(form.valor.value);
  if (!(valor > 0)) return toast('Escribe una tasa válida, ej: 870');
  if (
    TASA_BS > 0 &&
    Math.abs(valor - TASA_BS) / TASA_BS > 0.3 &&
    !confirm(`La nueva tasa (${formatBs(valor)}) cambia más de 30% respecto a la actual (${formatBs(TASA_BS)}). ¿Continuar?`)
  )
    return;
  btn.classList.add('is-loading');
  try {
    const { message } = await api('/tasa', { method: 'POST', body: { valor } });
    form.reset();
    $('[data-tasa-preview]').textContent = TASA_HINT;
    await loadTasa();
    render(); // precios en Bs del listado con la nueva tasa
    toast(message);
  } catch (error) {
    toast(error.message);
  } finally {
    btn.classList.remove('is-loading');
  }
});

/* ---------- Listado ---------- */

async function loadRef() {
  const { data } = await api('/products/tallas');
  state.ref = data;
}

async function loadProducts() {
  $('#list').innerHTML = '<p class="adm-loading">Cargando productos…</p>';
  try {
    const { data } = await api('/products/admin');
    state.products = data;
    render();
  } catch (error) {
    $('#list').innerHTML = `<p class="adm-loading">${esc(error.message)}</p>`;
  }
}

function render() {
  const all = state.products;
  const stats = [
    ['Productos', all.length, true],
    ['Gorras', all.filter((p) => p.categoria === 'gorras').length],
    ['Calzado', all.filter((p) => p.categoria === 'zapatos').length],
    ['En promoción', all.filter((p) => p.etiqueta === 'PROMOCION').length],
    ['Ocultos', all.filter((p) => !p.activo || !p.imagen).length],
  ];
  $('#stats').innerHTML = stats
    .map(([label, n, neon]) => `<div class="adm-stat ${neon ? 'adm-stat--neon' : ''}"><b>${n}</b><small>${label}</small></div>`)
    .join('');

  const q = state.q.trim().toLowerCase();
  const list = all.filter(
    (p) => (state.filter === 'todos' || p.categoria === state.filter) && (!q || p.nombre.toLowerCase().includes(q))
  );

  if (!list.length) {
    $('#list').innerHTML = `
      <div class="empty">
        <h3 class="empty__title">${all.length ? 'Sin resultados' : 'Aún no hay productos'}</h3>
        <p class="empty__text">${all.length ? 'Prueba con otro filtro o nombre.' : 'Agrega tu primera gorra o calzado.'}</p>
      </div>`;
    return;
  }

  $('#list').innerHTML = list.map(itemHTML).join('');
}

function itemHTML(p) {
  const oculto = !p.activo || !p.imagen;
  const tallas =
    p.tipo === 'BROCHE' ? 'Broche · talla única' : p.tallas.filter((t) => t.disponible).map((t) => t.label).join(' · ') || 'Sin tallas';
  return `
  <article class="adm-item ${oculto ? 'is-off' : ''}">
    <div class="adm-item__img">${p.imagen ? `<img src="${cld(p.imagen, 160)}" alt="" loading="lazy">` : ''}</div>
    <div class="adm-item__info">
      <h3 class="adm-item__name">${esc(p.nombre)}</h3>
      <div class="adm-item__price">${p.precioAnteriorUSD ? `<span class="adm-item__old">${priceParts(p.precioAnteriorUSD).main}</span>` : ''}${priceParts(p.precioUSD).main}<small>${priceParts(p.precioUSD).sub}</small></div>
      <div class="adm-item__meta">
        <span class="tag">${p.categoria === 'gorras' ? 'Gorra' : 'Calzado'}</span>
        ${p.etiqueta === 'PROMOCION' ? `<span class="tag tag--promo">Promo${p.descuento ? ` -${p.descuento}%` : ''}</span>` : p.etiqueta ? `<span class="tag tag--neon">${esc(p.etiqueta)}</span>` : ''}
        ${p.destacado ? '<span class="tag">★ Destacado</span>' : ''}
        ${!p.activo ? '<span class="tag tag--off">Oculto</span>' : ''}
        ${!p.imagen ? '<span class="tag tag--off">Sin foto</span>' : ''}
        <span>${esc(tallas)}</span>
      </div>
    </div>
    <div class="adm-item__actions">
      <button class="btn btn--ghost btn--sm" type="button" data-edit="${p.id}">${ICON.edit} Editar</button>
      <button class="btn btn--ghost btn--sm btn--danger" type="button" data-delete="${p.id}" aria-label="Eliminar ${esc(p.nombre)}">${ICON.trash}</button>
    </div>
  </article>`;
}

$$('[data-filter]').forEach((b) =>
  b.addEventListener('click', () => {
    state.filter = b.dataset.filter;
    $$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  })
);

$('[data-search]').addEventListener('input', (e) => {
  state.q = e.target.value;
  render();
});

$('#list').addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-edit]');
  if (edit) return openEditor(state.products.find((p) => p.id === edit.dataset.edit));

  const del = e.target.closest('[data-delete]');
  if (del) {
    const p = state.products.find((x) => x.id === del.dataset.delete);
    if (!confirm(`¿Eliminar "${p.nombre}"? También se borran sus fotos. No se puede deshacer.`)) return;
    del.classList.add('is-loading');
    try {
      await api(`/products/${p.id}`, { method: 'DELETE' });
      state.products = state.products.filter((x) => x.id !== p.id);
      render();
      toast('Producto eliminado');
    } catch (error) {
      toast(error.message);
      del.classList.remove('is-loading');
    }
  }
});

$('[data-new]').addEventListener('click', () => openEditor(null));

/* ---------- Editor ---------- */

const dlg = $('#editor');
const form = $('#editor-form');

function openEditor(product) {
  state.editing = product;
  clearNewFiles();
  form.reset();
  $('[data-editor-error]').hidden = true;

  $('[data-editor-eyebrow]').textContent = product ? 'Editar producto' : 'Nuevo producto';
  $('#editor-title').textContent = product ? product.nombre : 'Agregar';

  const categoria = product?.categoria || 'gorras';
  form.categoria.value = categoria;
  form.tipo.value = product?.tipo || 'CERRADA';
  if (product) {
    form.nombre.value = product.nombre;
    form.precioUSD.value = product.precioUSD;
    form.etiqueta.value = product.etiqueta || '';
    form.precioAnteriorUSD.value = product.precioAnteriorUSD ?? '';
    form.descripcion.value = product.descripcion || '';
    form.destacado.checked = product.destacado;
    form.activo.checked = product.activo;
  }

  renderTallas(categoria, product?.categoria === categoria ? product.tallas : null);
  renderPhotos();
  togglePromo();
  dlg.showModal();
  form.nombre.focus();
}

// Gorras de broche: sin tallas (se oculta el bloque de tallas)
const esBrocheForm = () => form.categoria.value === 'gorras' && form.tipo.value === 'BROCHE';
function toggleTipo() {
  $('[data-tipo-box]').hidden = form.categoria.value !== 'gorras';
  $('[data-tallas-box]').hidden = esBrocheForm();
}

function renderTallas(categoria, actuales) {
  toggleTipo();
  const ref = state.ref.tallas[categoria];
  const calzado = categoria === 'zapatos';
  // Gorras nuevas: las 3 marcadas · Calzado nuevo: 38 a 43 marcadas
  const marcada = (t) =>
    actuales
      ? actuales.some((a) => a.label === t.label && a.disponible)
      : !calzado || (Number(t.label) >= 38 && Number(t.label) <= 43);

  $('[data-tallas-legend]').textContent = calzado ? 'Tallas de calzado (EU · largo del pie)' : 'Medidas de gorra (fitted)';
  $('[data-tallas-hint]').textContent = calzado
    ? 'Marca las tallas que tienes o puedes conseguir bajo pedido.'
    : 'Gorra cerrada: 7 1/8 ≈ 56.8 cm · 7 1/4 ≈ 57.7 cm · 7 3/8 ≈ 58.7 cm de contorno.';
  $('[data-tallas]').innerHTML = ref
    .map(
      (t) => `
    <label class="size">
      <input type="checkbox" name="talla" value="${esc(t.label)}" ${marcada(t) ? 'checked' : ''}>
      <span><b>${esc(t.label)}</b><small>${t.cm} cm</small></span>
    </label>`
    )
    .join('');
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'tipo') toggleTipo();
  if (e.target.name === 'categoria') {
    const p = state.editing;
    renderTallas(e.target.value, p?.categoria === e.target.value ? p.tallas : null);
  }
});

const esPromo = () => form.etiqueta.value === 'PROMOCION';
const PROMO_HINT = 'El precio de arriba es el de oferta; este se muestra tachado.';

function updateBsPreview() {
  const usd = Number(form.precioUSD.value);
  const { main, sub } = priceParts(usd);
  $('[data-bs-preview]').textContent = usd > 0 ? `En tienda: ${main}${sub ? ` · ${sub}` : ''}` : '';

  const antes = Number(form.precioAnteriorUSD.value);
  let hint = PROMO_HINT;
  if (esPromo() && antes > 0 && usd > 0) {
    hint = antes > usd
      ? `Se verá: ${priceParts(antes).main} tachado → ${main} (-${Math.round((1 - usd / antes) * 100)}%)`
      : 'Debe ser mayor que el precio de oferta';
  }
  $('[data-promo-preview]').textContent = hint;
}

function togglePromo() {
  $('[data-promo-box]').hidden = !esPromo();
  $('[data-precio-label]').textContent = esPromo() ? 'Precio de oferta (USD)' : 'Precio (USD)';
  updateBsPreview();
}

form.precioUSD.addEventListener('input', updateBsPreview);
form.precioAnteriorUSD.addEventListener('input', updateBsPreview);
form.etiqueta.addEventListener('change', togglePromo);

/* Fotos */

function clearNewFiles() {
  state.newFiles.forEach((f) => URL.revokeObjectURL(f.url));
  state.newFiles = [];
}

function renderPhotos() {
  const existing = state.editing?.imagenes || [];
  const htmlExisting = existing
    .map(
      (img, i) => `
    <div class="adm-photo ${i === 0 ? 'is-main' : ''}" data-img="${img.id}">
      <img src="${cld(img.url, 240)}" alt="">
      <div class="adm-photo__tools">
        ${i > 0 ? `<button type="button" data-main="${img.id}" title="Hacer principal" aria-label="Hacer principal">${ICON.star}</button>` : ''}
        <button type="button" data-remove-img="${img.id}" title="Eliminar foto" aria-label="Eliminar foto">${ICON.trash}</button>
      </div>
      ${img.bytes ? `<span class="adm-photo__size">${fmtKB(img.bytes)}</span>` : ''}
    </div>`
    )
    .join('');
  const htmlNew = state.newFiles
    .map(
      (f, i) => `
    <div class="adm-photo is-new ${!existing.length && i === 0 ? 'is-main' : ''}">
      <img src="${f.url}" alt="">
      <div class="adm-photo__tools">
        <button type="button" data-remove-new="${i}" title="Quitar" aria-label="Quitar foto">${ICON.close}</button>
      </div>
      <span class="adm-photo__size">${fmtKB(f.original)} → ${fmtKB(f.file.size)}</span>
    </div>`
    )
    .join('');
  $('[data-photos]').innerHTML = htmlExisting + htmlNew;
}

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  const libres = MAX_FILES - state.newFiles.length;
  if (files.length > libres) toast(`Máximo ${MAX_FILES} fotos por vez`);
  for (const original of files.slice(0, Math.max(0, libres))) {
    const file = await compressImage(original);
    state.newFiles.push({ file, url: URL.createObjectURL(file), original: original.size });
    renderPhotos();
  }
}

const drop = $('.adm-drop');
$('[data-files]').addEventListener('change', (e) => {
  addFiles(e.target.files);
  e.target.value = '';
});
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.add('is-over')));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));

$('[data-photos]').addEventListener('click', async (e) => {
  const quitar = e.target.closest('[data-remove-new]');
  if (quitar) {
    const [f] = state.newFiles.splice(Number(quitar.dataset.removeNew), 1);
    URL.revokeObjectURL(f.url);
    return renderPhotos();
  }

  const p = state.editing;
  const main = e.target.closest('[data-main]');
  const del = e.target.closest('[data-remove-img]');
  if (!p || (!main && !del)) return;

  if (del && !confirm('¿Eliminar esta foto? Se borra también de Cloudinary.')) return;
  const card = e.target.closest('.adm-photo');
  card.classList.add('is-busy');
  try {
    if (main) {
      const { data } = await api(`/products/${p.id}/images/${main.dataset.main}`, { method: 'PATCH' });
      syncProduct(data);
      toast('Foto principal actualizada');
    } else {
      await api(`/products/${p.id}/images/${del.dataset.removeImg}`, { method: 'DELETE' });
      const { data } = await api(`/products/${p.id}`);
      syncProduct(data);
      toast('Foto eliminada');
    }
    renderPhotos();
  } catch (error) {
    card.classList.remove('is-busy');
    toast(error.message);
  }
});

function syncProduct(data) {
  state.editing = data;
  const i = state.products.findIndex((p) => p.id === data.id);
  if (i >= 0) state.products[i] = data;
  else state.products.unshift(data);
  render();
}

/* Guardar */

function readForm() {
  const categoria = form.categoria.value;
  const seleccionadas = $$('input[name="talla"]:checked', form).map((i) => i.value);
  return {
    nombre: form.nombre.value.trim(),
    categoria,
    ...(categoria === 'gorras' && { tipo: form.tipo.value }),
    precioUSD: form.precioUSD.value,
    etiqueta: form.etiqueta.value,
    precioAnteriorUSD: esPromo() ? form.precioAnteriorUSD.value : '',
    descripcion: form.descripcion.value.trim(),
    destacado: form.destacado.checked,
    activo: form.activo.checked,
    // Se envían todas las tallas de referencia, marcando cuáles están disponibles
    // (broche: sin tallas)
    tallas: esBrocheForm()
      ? []
      : state.ref.tallas[categoria]
          .filter((t) => seleccionadas.includes(t.label) || state.editing?.tallas.some((a) => a.label === t.label))
          .map((t) => ({ label: t.label, cm: t.cm, disponible: seleccionadas.includes(t.label) })),
    seleccionadas,
  };
}

function validate(d) {
  if (d.nombre.length < 2) return 'Escribe el nombre del producto';
  if (!(Number(d.precioUSD) > 0)) return 'El precio debe ser mayor a 0';
  if (d.etiqueta === 'PROMOCION' && !(Number(d.precioAnteriorUSD) > Number(d.precioUSD))) {
    return 'En promoción, el precio anterior debe ser mayor al precio de oferta';
  }
  if (!esBrocheForm() && !d.seleccionadas.length) return 'Marca al menos una talla';
  const fotos = (state.editing?.imagenes.length || 0) + state.newFiles.length;
  if (!fotos) return 'Agrega al menos una foto';
  return '';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('[data-editor-error]');
  const btn = $('[data-save]');
  const d = readForm();
  const problema = validate(d);
  if (problema) {
    err.textContent = problema;
    err.hidden = false;
    return;
  }
  err.hidden = true;
  btn.classList.add('is-loading');
  // eslint-disable-next-line no-unused-vars
  const { seleccionadas, ...payload } = d;

  try {
    let data;
    if (!state.editing) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => fd.append(k, k === 'tallas' ? JSON.stringify(v) : String(v)));
      state.newFiles.forEach((f) => fd.append('images', f.file));
      btn.textContent = 'Subiendo fotos…';
      ({ data } = await api('/products', { method: 'POST', form: fd }));
      clearNewFiles();
      syncProduct(data);
      toast(`${data.categoria === 'gorras' ? 'Gorra' : 'Calzado'} creado`);
    } else {
      ({ data } = await api(`/products/${state.editing.id}`, { method: 'PUT', body: payload }));
      syncProduct(data);
      if (state.newFiles.length) {
        const fd = new FormData();
        state.newFiles.forEach((f) => fd.append('images', f.file));
        btn.textContent = 'Subiendo fotos…';
        ({ data } = await api(`/products/${data.id}/images`, { method: 'POST', form: fd }));
        clearNewFiles();
        syncProduct(data);
      }
      toast('Cambios guardados');
    }
    dlg.close();
  } catch (error) {
    err.textContent = error.message;
    err.hidden = false;
  } finally {
    btn.classList.remove('is-loading');
    btn.textContent = 'Guardar';
  }
});

$$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));
dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
dlg.addEventListener('close', () => {
  clearNewFiles();
  state.editing = null;
});

boot();
