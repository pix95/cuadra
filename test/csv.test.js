// CSV con los datos del coche: exportar e importar de nuevo. Datos inventados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { op, estadoVacio, normalizarPartida } from "../shared/modelo.js";
import { exportarCSV, importarCSV } from "../shared/csv.js";

function conCoche() {
  const d = estadoVacio();
  const gasolina = normalizarPartida({ id: "00000000-0000-4000-8000-000000000101", nombre: "Gasolina", importe: 100 });
  const taller = normalizarPartida({ id: "00000000-0000-4000-8000-000000000102", nombre: "Taller", importe: 200, frecuencia: "Anual" });
  d.partidas.push(gasolina, taller);
  const { r: v } = op.crearVehiculo(d, { nombre: "Coche de prueba", kmIniciales: 1000, partidaCombustible: gasolina.id, partidaMantenimiento: taller.id });
  op.guardarGasto(d, { tipo: "gasto", partidaId: gasolina.id, fecha: "2030-01-10", importe: 45 }, { repostaje: { vehiculoId: v.id, km: 1500, litros: 30, lleno: false, gasolinera: "Estación; con punto y coma" } });
  op.guardarGasto(d, { tipo: "gasto", partidaId: taller.id, fecha: "2030-01-20", importe: 120 }, { mantenimiento: { vehiculoId: v.id, tipo: "aceite", km: 1700, taller: "Taller inventado", notas: "Filtro" } });
  return d;
}

test("CSV: el repostaje y el mantenimiento van en sus columnas y se recuperan al importar", () => {
  const origen = conCoche();
  const csv = exportarCSV(origen);
  assert.match(csv, /Vehículo;Litros;Km;Lleno;Gasolinera;Mantenimiento;Taller;Notas/);
  assert.match(csv, /Coche de prueba;30,00;1500;No;"Estación; con punto y coma"/);

  // Otro dispositivo con el mismo coche y las mismas partidas, sin movimientos
  const destino = estadoVacio();
  destino.partidas = origen.partidas.map((p) => ({ ...p }));
  destino.vehiculos = origen.vehiculos.map((v) => ({ ...v }));
  const { r } = importarCSV(destino, csv);
  assert.equal(r.importados, 2);
  assert.deepEqual([r.repostajes, r.mantenimientos], [1, 1]);
  const rep = destino.repostajes[0];
  assert.deepEqual([rep.km, rep.litros, rep.lleno, rep.gasolinera], [1500, 30, false, "Estación; con punto y coma"]);
  assert.equal(destino.movimientos.find((m) => m.id === rep.movimientoId).importe, 45);
  assert.deepEqual([destino.mantenimientos[0].tipo, destino.mantenimientos[0].taller], ["aceite", "Taller inventado"]);

  // Importar otra vez no duplica nada
  const otra = importarCSV(destino, csv).r;
  assert.deepEqual([otra.importados, otra.repetidos, destino.repostajes.length], [0, 2, 1]);
});
