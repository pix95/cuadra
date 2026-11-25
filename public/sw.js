// Cuadra · service worker
// Guarda la app en el dispositivo para que abra al instante y funcione sin
// conexión. La versión la pone "npm run build" (cambia en cada publicación).
const VERSION = "__VERSION__";
const CACHE = `cuadra-${VERSION}`;
const BASICOS = ["./", "./index.html", "./manifest.webmanifest", "./icono.svg", "./icono-192.png", "./icono-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(BASICOS.map((u) => c.add(u).catch(() => null))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Borra las copias de versiones anteriores (también las de la Cuadra antigua)
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Supabase y cualquier otra web van siempre a la red
  if (url.origin !== self.location.origin) return;
  // El servidor local (modo Node) tampoco se guarda
  if (url.pathname.includes("/api/")) return;

  // La página: primero la red (para coger la versión nueva); sin red, la copia
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copia));
          }
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Los archivos de la app llevan su huella en el nombre: si están guardados, no cambian
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const guardada = await cache.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
  );
});
