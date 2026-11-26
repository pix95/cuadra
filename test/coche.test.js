// Pruebas del cuaderno del coche: consumo de lleno a lleno, costes, km,
// recordatorios y las operaciones enlazadas con los gastos. Datos inventados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { op, estadoVacio, normalizarPartida, OBJETIVO_FIJO } from "../shared/modelo.js";
import {
  tramosConsumo, consumoMedio, avisoConsumo, kmRecorridos, kmEstimados, costeCoche, preciosLitro, estadoRecordatorio,
  recordatoriosCoche, siguienteRecordatorio, combustibleMes, alertas,
} from "../src/lib/calculos.js";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const rep = (fecha, km, litros, lleno = true, importe = litros * 1.5) => ({ id: id(), vehiculoId: "v", fecha, km, litros, importe, lleno, gasolinera: "", movimientoId: null });

// ---------- Consumo ----------
test("consumo de lleno a lleno: el parcial suma litros y lo de antes del primer lleno no cuenta", () => {
  const tramos = tramosConsumo([
    rep("2030-01-02", 900, 20, false), // antes del primer lleno: no cuenta
    rep("2030-01-05", 1000, 40),
    rep("2030-01-20", 1300, 10, false), // parcial
    rep("2030-02-01", 1600, 32),
    rep("2030-02-20", 2100, 30),
  ]);
  assert.equal(tramos.length, 2);
  assert.deepEqual([tramos[0].km, tramos[0].litros, tramos[0].consumo], [600, 42, 7]);
  assert.deepEqual([tramos[1].km, tramos[1].litros, tramos[1].consumo], [500, 30, 6]);
  assert.equal(consumoMedio(tramos, "2030-03-01"), 6.55, "media ponderada: 72 l / 1.100 km");
});

test("sin dos llenos no hay tramo, y un parcial al final se queda esperando", () => {
  assert.deepEqual(tramosConsumo([rep("2030-01-05", 1000, 40)]), []);
  assert.equal(tramosConsumo([rep("2030-01-05", 1000, 40), rep("2030-01-15", 1200, 10, false)]).length, 0);
});

test("aviso de consumo: el último tramo gasta más de un 15 % sobre la media", () => {
  const base = [rep("2030-01-01", 1000, 40), rep("2030-01-15", 1500, 30), rep("2030-02-01", 2000, 30)];
  assert.equal(avisoConsumo(tramosConsumo([...base, rep("2030-02-15", 2500, 34)]), "2030-03-01"), null, "6,8 frente a 6: un 13 %");
  const a = avisoConsumo(tramosConsumo([...base, rep("2030-02-15", 2500, 36)]), "2030-03-01");
  assert.equal(a.media, 6);
  assert.equal(a.ultimo.consumo, 7.2);
  assert.equal(a.exceso, 20);
});

// ---------- Km, precio y costes ----------
function cocheConDatos() {
  const d = estadoVacio();
  const gasolina = normalizarPartida({ id: id(), nombre: "Gasolina", importe: 120 });
  const taller = normalizarPartida({ id: id(), nombre: "Mantenimiento coche", importe: 300, frecuencia: "Anual", recibo: true });
  d.partidas.push(gasolina, taller);
  const { r: v } = op.crearVehiculo(d, { nombre: "Coche de prueba", kmIniciales: 10000, partidaCombustible: gasolina.id, partidaMantenimiento: taller.id, creado: "2030-01-01T10:00:00Z" });
  return { d, v, gasolina, taller };
}
const repostar = (d, v, fecha, km, litros, importe, lleno = true) =>
  op.guardarGasto(d, { tipo: "gasto", partidaId: v.partidaCombustible, fecha, importe }, { repostaje: { vehiculoId: v.id, km, litros, lleno } }).r;

test("km al mes, estimación de hoy y precio por litro", () => {
  const { d, v } = cocheConDatos();
  repostar(d, v, "2030-01-31", 10800, 40, 60);
  repostar(d, v, "2030-03-02", 11600, 40, 64);
  const km = kmRecorridos(d, v, "2030-03-10");
  assert.equal(km.km, 1600);
  assert.equal(km.alMes, Math.round((1600 / 60) * 30.44));
  assert.equal(kmEstimados(d, v, "2030-03-02"), 11600);
  assert.ok(kmEstimados(d, v, "2030-04-01") > 11600, "suma lo que se suele hacer desde la última lectura");
  const p = preciosLitro(d, v, "2030-03-10");
  assert.equal(p.ultimo, 1.6);
  assert.equal(p.media, 1.55);
});

test("coste del coche: combustible, mantenimiento y partidas «del coche» con su porcentaje", () => {
  const { d, v, taller } = cocheConDatos();
  repostar(d, v, "2030-01-31", 10800, 40, 60);
  repostar(d, v, "2030-03-02", 11600, 40, 60);
  op.guardarGasto(d, { tipo: "gasto", partidaId: taller.id, fecha: "2030-02-10", importe: 90 }, { mantenimiento: { vehiculoId: v.id, tipo: "aceite", km: 11000 } });
  op.crearPartida(d, { nombre: "Seguro", importe: 360, frecuencia: "Anual", vehiculoId: v.id, pctCoche: 50 });
  const c = costeCoche(d, v, "2030-04-01");
  assert.equal(c.combustible, 120);
  assert.equal(c.mantenimiento, 90);
  assert.equal(c.fijos, 15, "la mitad de 360 € al año son 15 € al mes");
  assert.equal(c.alMes, Math.round(((120 + 90) / c.meses + 15) * 100) / 100);
  assert.equal(c.porKmCombustible, 0.075, "120 € / 1.600 km");
  assert.equal(c.porKmTotal, 0.131, "210 € / 1.600 km");
  assert.deepEqual(combustibleMes(d, v, "2030-03"), { partida: d.partidas[0], gastado: 60, presupuesto: 120 });
});

// ---------- Recordatorios ----------
test("recordatorios: vencido, pronto por fecha o por km y al día", () => {
  const r = (x) => ({ id: id(), vehiculoId: "v", tipo: "revision", nota: "", proximaFecha: null, proximosKm: null, repetirMeses: null, repetirKm: null, ...x });
  assert.equal(estadoRecordatorio(r({ proximaFecha: "2030-03-01" }), 0, null, "2030-03-05").estado, "vencido");
  assert.equal(estadoRecordatorio(r({ tipo: "itv", proximaFecha: "2030-03-20" }), 0, null, "2030-03-01").texto, "ITV en 3 semanas");
  const porKm = estadoRecordatorio(r({ proximaFecha: "2031-01-01", proximosKm: 20800 }), 20000, 1000, "2030-03-01");
  assert.equal(porKm.estado, "pronto");
  assert.equal(porKm.texto, "Revisión en 800 km");
  assert.equal(estadoRecordatorio(r({ proximaFecha: "2030-09-01", proximosKm: 30000 }), 20000, 1000, "2030-03-01").estado, "al-dia");
  assert.equal(estadoRecordatorio(r({ proximosKm: 19900 }), 20000, 1000, "2030-03-01").texto, "Revisión pasado de 100 km");
});

test("tras un mantenimiento, el recordatorio pasa a su siguiente fecha y km", () => {
  const rec = { proximaFecha: "2030-03-01", proximosKm: 15000, repetirMeses: 12, repetirKm: 15000 };
  assert.deepEqual(siguienteRecordatorio(rec, "2030-02-20", 14800), { proximaFecha: "2031-02-20", proximosKm: 29800 });
  assert.deepEqual(siguienteRecordatorio({ ...rec, repetirKm: null }, "2030-02-20", 14800), { proximaFecha: "2031-02-20", proximosKm: 15000 });
});

test("los recordatorios cercanos y el consumo alto salen en la campana", () => {
  const { d, v } = cocheConDatos();
  op.crearRecordatorio(d, { vehiculoId: v.id, tipo: "itv", proximaFecha: "2030-03-20", repetirMeses: 24 });
  op.crearRecordatorio(d, { vehiculoId: v.id, tipo: "seguro", proximaFecha: "2030-12-01" });
  const lista = recordatoriosCoche(d, v, "2030-03-01");
  assert.deepEqual(lista.map((x) => x.estado), ["pronto", "al-dia"]);
  const avisos = alertas(d, "2030-03", "2030-03-01").filter((a) => a.tipo === "coche");
  assert.deepEqual(avisos.map((a) => a.texto), ["ITV en 3 semanas."]);
});

// ---------- Operaciones ----------
test("repostar crea el gasto y el repostaje enlazados en la misma operación", () => {
  const { d, v } = cocheConDatos();
  const { r, cambios } = op.guardarGasto(d, { tipo: "gasto", partidaId: v.partidaCombustible, fecha: "2030-02-01", importe: 61.5 }, { repostaje: { vehiculoId: v.id, km: 10500, litros: 41, lleno: true, gasolinera: "Estación inventada" } });
  assert.equal(d.repostajes.length, 1);
  assert.equal(d.repostajes[0].movimientoId, r.id);
  assert.equal(d.repostajes[0].importe, 61.5);
  assert.deepEqual(cambios.map((c) => c.tabla), ["movimientos", "repostajes"], "primero el gasto, luego el repostaje");
});

test("los km no pueden ir hacia atrás: ni menos que el anterior ni más que el siguiente", () => {
  const { d, v } = cocheConDatos();
  repostar(d, v, "2030-02-01", 10500, 40, 60);
  repostar(d, v, "2030-03-01", 11200, 40, 60);
  assert.throws(() => repostar(d, v, "2030-02-15", 10400, 20, 30), /no pueden ser menos que los del repostaje anterior, del 01\/02\/2030/);
  assert.throws(() => repostar(d, v, "2030-02-15", 11300, 20, 30), /no pueden ser más que los del repostaje siguiente/);
  assert.equal(d.repostajes.length, 2);
  assert.equal(d.movimientos.length, 2, "si falla no se guarda el gasto");
});

test("corregir el gasto actualiza el repostaje; borrar uno borra los dos y deshacer los recupera", () => {
  const { d, v } = cocheConDatos();
  const g = repostar(d, v, "2030-02-01", 10500, 40, 60);
  const { r: r2 } = op.guardarGasto(d, { ...d.movimientos[0], importe: 62, fecha: "2030-02-02" });
  assert.deepEqual([d.repostajes[0].importe, d.repostajes[0].fecha, d.repostajes[0].litros], [62, "2030-02-02", 40]);
  // «Deshacer» de la corrección
  op.restaurarMovimientos(d, r2.deshacer.antes, r2.deshacer.quitar);
  assert.deepEqual([d.movimientos[0].importe, d.repostajes[0].importe], [60, 60]);
  // Borrar desde el historial y deshacer
  const { r: b } = op.borrarMovimiento(d, g.id);
  assert.deepEqual([d.movimientos.length, d.repostajes.length], [0, 0]);
  op.restaurarMovimientos(d, ...JSON.parse(JSON.stringify([b.borrados, null])));
  assert.deepEqual([d.movimientos.length, d.repostajes.length], [1, 1]);
  assert.equal(d.repostajes[0].movimientoId, g.id);
});

test("añadir litros a un gasto de gasolina ya apuntado lo convierte en repostaje (y quitarlos lo deshace)", () => {
  const { d, v } = cocheConDatos();
  const { r: g } = op.guardarGasto(d, { tipo: "gasto", partidaId: v.partidaCombustible, fecha: "2030-02-01", importe: 50 });
  assert.equal(d.repostajes.length, 0);
  const { r } = op.guardarGasto(d, { ...g }, { repostaje: { vehiculoId: v.id, km: 10400, litros: 33, lleno: false } });
  assert.equal(d.repostajes.length, 1);
  assert.deepEqual(r.deshacer.quitar, [d.repostajes[0].id]);
  op.guardarGasto(d, { ...g }, { repostaje: null });
  assert.equal(d.repostajes.length, 0);
});

test("mantenimiento de una partida no mensual: se paga desde la hucha y queda enlazado", () => {
  const { d, v, taller } = cocheConDatos();
  op.crearMovimiento(d, { tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-01-10", importe: 100 });
  const { r } = op.guardarGasto(d, { tipo: "gasto", partidaId: taller.id, fecha: "2030-02-10", importe: 140 }, { desdeHucha: true, mantenimiento: { vehiculoId: v.id, tipo: "revision", km: 11000, taller: "Taller inventado" } });
  assert.deepEqual([r.deHucha, r.deCuenta], [100, 40]);
  assert.equal(d.mantenimientos[0].movimientoId, r.id);
  const { r: b } = op.borrarMovimiento(d, r.id);
  assert.equal(b.borrados.length, 3, "gasto, retirada de la hucha y mantenimiento");
  assert.equal(d.mantenimientos.length, 0);
});

test("borrar el vehículo borra su cuaderno pero deja los gastos en Cuadra", () => {
  const { d, v } = cocheConDatos();
  repostar(d, v, "2030-02-01", 10500, 40, 60);
  op.crearRecordatorio(d, { vehiculoId: v.id, tipo: "itv", proximaFecha: "2031-01-01" });
  const { r: p } = op.crearPartida(d, { nombre: "Seguro", importe: 300, frecuencia: "Anual", vehiculoId: v.id });
  op.borrarVehiculo(d, v.id);
  assert.deepEqual([d.vehiculos.length, d.repostajes.length, d.recordatorios.length, d.movimientos.length], [0, 0, 0, 1]);
  assert.equal(d.partidas.find((x) => x.id === p.id).vehiculoId, null);
});

test("validación: recordatorio sin fecha ni km y porcentaje del coche fuera de rango", () => {
  const { d, v } = cocheConDatos();
  assert.throws(() => op.crearRecordatorio(d, { vehiculoId: v.id, tipo: "revision" }), /fecha, unos km/);
  assert.throws(() => op.crearPartida(d, { nombre: "Parking", importe: 50, vehiculoId: v.id, pctCoche: 150 }), /porcentaje/);
  assert.equal(op.crearPartida(d, { nombre: "Parking", importe: 50, vehiculoId: v.id, pctCoche: 40 }).r.pctCoche, 40);
});
