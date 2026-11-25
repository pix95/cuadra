// Servidor de Cuadra: API en /api y, si existe la carpeta dist/ (npm run build),
// también la app ya compilada.
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { iniciar, RAIZ, DIR } from "./db.js";
import { rutas } from "./rutas.js";

const PUERTO = Number(process.env.PORT) || 3001;
const EN_RED = process.argv.includes("--red");
const HOST = EN_RED ? "0.0.0.0" : "127.0.0.1";

try {
  iniciar();
} catch (e) {
  console.error("\n✖ " + e.message + "\n");
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "10mb" }));
app.use("/api", rutas);
app.use("/api", (req, res) => res.status(404).json({ error: "Esa ruta de la API no existe." }));

const DIST = path.join(RAIZ, "dist");
const hayApp = fs.existsSync(path.join(DIST, "index.html"));
if (hayApp) {
  // Los archivos de assets/ llevan su huella en el nombre y no cambian nunca;
  // el resto (index, sw.js, manifest) se revisa siempre.
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders: (res, ruta) => res.setHeader("Cache-Control", ruta.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache"),
    })
  );
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(DIST, "index.html"));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.expose ? err.message : "Algo ha fallado en el servidor." });
});

app.listen(PUERTO, HOST, () => {
  console.log(`\n  Cuadra · servidor listo`);
  console.log(`  Datos en:  ${DIR}`);
  if (hayApp) {
    console.log(`  App:       http://localhost:${PUERTO}`);
    if (EN_RED) {
      for (const lista of Object.values(os.networkInterfaces())) {
        for (const i of lista || []) {
          if (i.family === "IPv4" && !i.internal) console.log(`  En el móvil (misma wifi): http://${i.address}:${PUERTO}`);
        }
      }
    }
  } else {
    console.log(`  API:       http://localhost:${PUERTO}/api  (la app se sirve con "npm run dev" o tras "npm run build")`);
  }
  console.log("");
});
