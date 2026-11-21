/**
 * npm run seed
 * 1) Crea (o actualiza la contraseña de) el administrador desde el .env
 * 2) Si no hay productos, carga el catálogo inicial que tenía la tienda
 */
import * as dotenv from "dotenv";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import {
  TALLAS_GORRA,
  TALLAS_CALZADO,
} from "../app/api/v1/products/model.js";

dotenv.config();
const prisma = new PrismaClient();

const IMG = "https://res.cloudinary.com/v1tbindq/image/upload/";

const gorra = () => TALLAS_GORRA.map((t, orden) => ({ ...t, orden }));
const calzado = () =>
  TALLAS_CALZADO.filter((t) => Number(t.label) >= 40 && Number(t.label) <= 44).map(
    (t, orden) => ({ ...t, orden }),
  );

const PRODUCTS = [
  {
    slug: "gorra-black-rose",
    nombre: "Gorra Black Rose",
    categoria: "gorras",
    imagen: "v1793993571/WhatsApp_Image_2026-11-02_at_8.33.38_AM.jpg",
    descripcion:
      "Negra total con letras góticas blancas y una rosa roja bordada en alto relieve. Perfil curvo de 6 paneles y visera precurvada. La que se roba las miradas.",
    precioUSD: 22,
    destacado: true,
    etiqueta: "NUEVO",
  },
  {
    slug: "gorra-pink-maple",
    nombre: "Gorra Pink Maple",
    categoria: "gorras",
    imagen: "v1793993571/WhatsApp_Image_2026-11-02_at_8.33.37_AM.jpg",
    descripcion:
      "Bordado tono sobre tono en negro con hoja de arce rosa como único golpe de color. Discreta de lejos, detallada de cerca.",
    precioUSD: 20,
    destacado: false,
    etiqueta: null,
  },
  {
    slug: "gorra-red-maple",
    nombre: "Gorra Red Maple",
    categoria: "gorras",
    imagen: "v1793993571/WhatsApp_Image_2026-11-02_at_8.33.41_AM.jpg",
    descripcion:
      "Base negra con ave bordada en negro mate y hoja de arce roja al frente, más logo lateral en rojo. Combina con todo lo oscuro de tu clóset.",
    precioUSD: 20,
    destacado: false,
    etiqueta: null,
  },
  {
    slug: "gorra-cream-teal",
    nombre: "Gorra Cream Teal",
    categoria: "gorras",
    imagen: "v1793993571/WhatsApp_Image_2026-11-02_at_8.33.39_AM.jpg",
    descripcion:
      "Corona crema con visera negra y letras góticas negras perfiladas en turquesa. El two-tone que levanta cualquier outfit básico.",
    precioUSD: 25,
    destacado: true,
    etiqueta: "NUEVO",
  },
  {
    slug: "low-mocha-reverse",
    nombre: "Low Mocha Reverse",
    categoria: "zapatos",
    imagen: "v1793993571/WhatsApp_Image_2026-11-02_at_8.34.01_AM_1.jpg",
    descripcion:
      "Low-top en nobuk negro con paneles marrón moca, trazo lateral invertido en blanco hueso y suela color vintage. Detalle rojo en el talón y cordones negros.",
    precioUSD: 75,
    destacado: true,
    etiqueta: "BAJO PEDIDO",
  },
  {
    slug: "runner-black-orange",
    nombre: "Runner Black Orange",
    categoria: "zapatos",
    imagen: "v1793993572/WhatsApp_Image_2026-11-02_at_8.34.01_AM_2.jpg",
    descripcion:
      "Running de malla negra transpirable con franjas laterales blancas, talón naranja y mediasuela blanca de alta amortiguación. Para correr o para el día a día.",
    precioUSD: 60,
    destacado: false,
    etiqueta: "NUEVO",
  },
  {
    slug: "low-panda",
    nombre: "Low Panda B/N",
    categoria: "zapatos",
    imagen: "v1793993572/WhatsApp_Image_2026-11-02_at_8.34.01_AM.jpg",
    descripcion:
      "El clásico blanco y negro: capellada blanca con overlays negros en cuero sintético, suela blanca con base negra. Va con todo, siempre.",
    precioUSD: 55,
    destacado: true,
    etiqueta: "BAJO PEDIDO",
  },
];

const seedAdmin = async () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Define ADMIN_EMAIL y ADMIN_PASSWORD en el .env");
  }
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email },
    update: { password, role: "admin", state: true },
    create: { email, password, name: ADMIN_NAME || "Administrador", role: "admin" },
  });
  console.log(`Admin listo: ${email}`);
};

const seedProducts = async () => {
  const total = await prisma.product.count();
  if (total > 0) {
    console.log(`Ya hay ${total} productos: no se carga el catálogo inicial`);
    return;
  }

  // Orden inverso para que el primero quede como el más reciente
  for (const p of [...PRODUCTS].reverse()) {
    const { imagen, ...data } = p;
    await prisma.product.create({
      data: {
        ...data,
        tallas: { create: p.categoria === "gorras" ? gorra() : calzado() },
        images: { create: [{ url: IMG + imagen, orden: 0 }] },
      },
    });
  }
  console.log(`Catálogo inicial cargado: ${PRODUCTS.length} productos`);
};

// Tasa inicial solo si nunca se ha cargado una (luego se cambia desde /admin)
const seedTasa = async () => {
  const total = await prisma.tasaCambio.count();
  if (total > 0) return;
  const valor = Number(process.env.TASA_INICIAL) || 870;
  await prisma.tasaCambio.create({ data: { valor } });
  console.log(`Tasa inicial: ${valor} Bs por $1`);
};

try {
  await seedAdmin();
  await seedTasa();
  await seedProducts();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
