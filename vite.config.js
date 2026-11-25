import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Pone una versión nueva al service worker en cada compilación, para que los
// móviles descarguen la app actualizada y borren la copia anterior.
const versionServiceWorker = () => ({
  name: "cuadra-version-sw",
  apply: "build",
  closeBundle() {
    const archivo = path.resolve("dist/sw.js");
    if (!fs.existsSync(archivo)) return;
    const version = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    fs.writeFileSync(archivo, fs.readFileSync(archivo, "utf8").replace("__VERSION__", version));
  },
});

export default defineConfig({
  // Rutas relativas: funciona igual en GitHub Pages (/cuadra/) que en el servidor local
  base: "./",
  plugins: [react(), versionServiceWorker()],
  server: {
    port: 5173,
    // Solo en este ordenador
    proxy: { "/api": "http://127.0.0.1:3001" },
    watch: { ignored: ["**/datos/**", "**/version-anterior/**"] },
  },
  optimizeDeps: { entries: ["index.html"] },
  build: { outDir: "dist", emptyOutDir: true },
});
