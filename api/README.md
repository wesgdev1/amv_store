# AMV STORE — API + Panel admin

Node (ESM) · Express 4 · Prisma 6 + PostgreSQL · JWT · multer + Cloudinary.
Express sirve también el front (`../web`): tienda en `/` y panel en `/admin/`.

## Arranque

```bash
npm install
npx prisma db push     # crea/actualiza tablas (uuid)
npm run seed           # crea el admin del .env + catálogo inicial si está vacío
npm run dev            # http://localhost:3000  ·  http://localhost:3000/admin/
```

## Estructura

```
api/
  index.js                    # servidor http
  app/index.js                # express, /api y /api/v1, estáticos, error handler
  app/config.js  database.js
  app/uploadPhotos/uploads.js # multer + Cloudinary (WebP, máx 1200px, q auto:eco)
  app/api/v1/auth.js          # JWT (solo role admin)
  app/api/v1/users/           # signin, me, change-password
  app/api/v1/products/        # gorras y calzado + fotos
  prisma/schema.prisma        # User, Product, Talla, Image
  prisma/seed.js
```

## Endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| POST | /api/v1/users/signin | — | Login admin → `meta.token` |
| GET | /api/v1/users/me | ✔ | Perfil |
| PUT | /api/v1/users/change-password | ✔ | `{ password, newPassword }` |
| GET | /api/v1/tasa | — | Tasa del día vigente (Bs por $1) |
| POST | /api/v1/tasa | ✔ | Nueva tasa `{ valor: 870 }` (queda historial) |
| GET | /api/v1/tasa/historial | ✔ | Últimos cambios de tasa |
| GET | /api/v1/products | — | Tienda: activos con foto. `?categoria=gorras\|zapatos&destacado=true&promo=true` |
| GET | /api/v1/products/tallas | — | Tallas permitidas por categoría |
| GET | /api/v1/products/slug/:slug | — | Detalle público |
| GET | /api/v1/products/:id | — | Detalle por id |
| GET | /api/v1/products/admin | ✔ | Todos (incluye ocultos). `?q=&categoria=` |
| POST | /api/v1/products | ✔ | multipart: campos + `images` (1–8) |
| PUT/PATCH | /api/v1/products/:id | ✔ | JSON, campos parciales + `tallas` |
| DELETE | /api/v1/products/:id | ✔ | Borra producto y sus fotos en Cloudinary |
| POST | /api/v1/products/:id/images | ✔ | multipart `images` |
| PATCH | /api/v1/products/:id/images/:imageId | ✔ | Marca foto principal |
| DELETE | /api/v1/products/:id/images/:imageId | ✔ | Borra foto |

### Crear (multipart/form-data)

```
nombre=Gorra Black Rose
categoria=gorras            # gorras | zapatos
tipo=CERRADA                # solo gorras: CERRADA (fitted) | BROCHE (ajustable, sin tallas)
precioUSD=22
etiqueta=NUEVO              # NUEVO | BAJO PEDIDO | PROMOCION | (vacío)
precioAnteriorUSD=30        # obligatorio con PROMOCION (> precioUSD, se muestra tachado)
descripcion=...
destacado=true
activo=true
tallas=["7 1/8","7 1/4","7 3/8"]                 # gorras cerradas (si se omite: las 3)
tallas=[{"label":"42","cm":27},{"label":"43"}]   # calzado (cm opcional: usa tabla EU)
images=<archivo> (repetir)
```

Gorras cerradas: solo **7 1/8 (56.8 cm) · 7 1/4 (57.7 cm) · 7 3/8 (58.7 cm)**.
Gorras de broche: sin tallas (en la tienda salen como "Ajustable (broche)").

Precios: se guardan en USD. En la tienda se muestran **primero en Bs** (precioUSD × tasa del día) y el USD como referencia.
Cambiar la tasa en /admin actualiza todos los precios en Bs al instante.
