/*
 * Service worker de la web de estudio: va cacheando lo que se usa (páginas,
 * JS/CSS, banco de preguntas, tests, láminas) para que la web funcione sin
 * conexión — salvo los vídeos embebidos de YouTube, que necesitan red.
 */
const CACHE = "carnetb-v1";
const MANIFIESTO_URL = "precache-manifest.json";
const PRECARGA_CONCURRENCIA = 3;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

/*
 * Precarga en segundo plano todo el dataset (temario + tests) listado en el
 * manifiesto, para que el estudio offline no dependa de haber visitado antes
 * cada test o tema. Se dispara desde main.tsx en ratos libres del navegador,
 * nunca en el arranque de la web. Salvaguardas de rendimiento:
 * - se salta si el navegador señala ahorro de datos o conexión lenta;
 * - concurrencia baja (no compite por ancho de banda con el uso normal);
 * - lo ya cacheado se omite, así que reintentos posteriores son casi gratis
 *   (solo añaden lo nuevo del manifiesto, p.ej. tras ampliar el temario).
 */
async function precargarDataset() {
  const conexion = self.navigator?.connection;
  if (conexion?.saveData || /^(slow-2g|2g)$/.test(conexion?.effectiveType ?? "")) return;

  const cache = await caches.open(CACHE);
  let rutas;
  try {
    const respuesta = await fetch(MANIFIESTO_URL);
    if (!respuesta.ok) return;
    await cache.put(MANIFIESTO_URL, respuesta.clone());
    rutas = await respuesta.json();
  } catch {
    return; // Sin red ahora mismo: se reintentará la próxima vez que se abra la web.
  }

  let siguiente = 0;
  async function trabajador() {
    while (siguiente < rutas.length) {
      const ruta = rutas[siguiente++];
      if (await cache.match(ruta)) continue;
      try {
        const respuesta = await fetch(ruta);
        if (respuesta.ok) await cache.put(ruta, respuesta);
      } catch {
        // Se corta la red a medias: esta ruta se reintenta en la próxima pasada.
      }
    }
  }
  await Promise.all(Array.from({ length: PRECARGA_CONCURRENCIA }, trabajador));
}

self.addEventListener("message", (evento) => {
  if (evento.data?.tipo === "precargar-dataset") evento.waitUntil(precargarDataset());
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET" || !peticion.url.startsWith(self.location.origin)) return;

  // Navegaciones: red primero (para estrenar versiones nuevas), caché sin conexión.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(peticion, copia));
          return respuesta;
        })
        .catch(async () => {
          const cacheada = await caches.match(peticion);
          return cacheada ?? (await caches.match(new URL("index.html", self.registration.scope).href)) ?? Response.error();
        })
    );
    return;
  }

  // Resto (JS, CSS, datos, imágenes): caché primero, refrescando en segundo plano.
  evento.respondWith(
    caches.match(peticion).then((cacheada) => {
      const red = fetch(peticion)
        .then((respuesta) => {
          if (respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(CACHE).then((cache) => cache.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => cacheada ?? Response.error());
      return cacheada ?? red;
    })
  );
});
