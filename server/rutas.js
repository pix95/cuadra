// API del modo local. Todo cuelga de /api. Las reglas están en shared/modelo.js.
import { Router } from "express";
import { leer, cambiar } from "./db.js";
import { op } from "../shared/modelo.js";
import { exportarCSV, importarCSV } from "../shared/csv.js";

export const rutas = Router();
const cuerpo = (req) => req.body || {};

rutas.get("/estado", (req, res) => res.json(leer()));

rutas.get("/copia.json", (req, res) => {
  res.setHeader("Content-Disposition", `attachment; filename="cuadra-copia-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(leer());
});

rutas.put("/ajustes", (req, res) => res.json(cambiar((d) => op.guardarAjustes(d, cuerpo(req)))));
rutas.put("/meses/:mes", (req, res) => res.json(cambiar((d) => op.ponerSueldo(d, req.params.mes, cuerpo(req).sueldo))));

// Crear, cambiar y borrar: el mismo patrón para cada colección
const colecciones = [
  ["movimientos", "Movimiento"],
  ["partidas", "Partida"],
  ["objetivos", "Objetivo"],
  ["simulaciones", "Simulacion"],
];
for (const [ruta, nombre] of colecciones) {
  rutas.post(`/${ruta}`, (req, res) => res.status(201).json(cambiar((d) => op[`crear${nombre}`](d, cuerpo(req)))));
  rutas.put(`/${ruta}/:id`, (req, res) => res.json(cambiar((d) => op[`actualizar${nombre}`](d, req.params.id, cuerpo(req)))));
  rutas.delete(`/${ruta}/:id`, (req, res) => res.json(cambiar((d) => op[`borrar${nombre}`](d, req.params.id))));
}

// Operaciones que tocan varios movimientos a la vez (gasto + retirada de la hucha…)
const OPS_COMPUESTAS = new Set(["guardarGasto", "borrarMovimiento", "restaurarMovimientos"]);
rutas.post("/op/:nombre", (req, res) => {
  const { nombre } = req.params;
  if (!OPS_COMPUESTAS.has(nombre)) return res.status(404).json({ error: "Esa operación no existe." });
  const args = Array.isArray(cuerpo(req).args) ? cuerpo(req).args : [];
  const r = cambiar((d) => op[nombre](d, ...args));
  res.json({ r, estado: leer() });
});

rutas.post("/simulaciones/:id/aplicar", (req, res) => res.json(cambiar((d) => op.aplicarSimulacion(d, req.params.id))));

rutas.get("/exportar.csv", (req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cuadra-movimientos-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(exportarCSV(leer()));
});

rutas.post("/importar", (req, res) => {
  const resumen = cambiar((d) => importarCSV(d, cuerpo(req).csv));
  res.json({ resumen, estado: leer() });
});
