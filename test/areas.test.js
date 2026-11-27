// Pruebas de las áreas (una por categoría del presupuesto). Datos inventados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { op, estadoVacio, normalizarPartida } from "../shared/modelo.js";
import { resumenArea, areas, categoriaVehiculo, vehiculosDeArea, esAreaDeVehiculos } from "../src/lib/calculos.js";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function datos() {
  const d = estadoVacio();
  const luz = normalizarPartida({ id: id(), nombre: "Luz", categoria: "Hogar", importe: 60, recibo: true });
  const agua = normalizarPartida({ id: id(), nombre: "Agua", categoria: "Hogar", importe: 90, frecuencia: "Trimestral", cobroAncla: "2030-05", recibo: true });
  const ocio = normalizarPartida({ id: id(), nombre: "Cine", categoria: "Ocio", importe: 40 });
  const gasolina = normalizarPartida({ id: id(), nombre: "Combustible", categoria: "Movilidad", importe: 100 });
  d.partidas.push(luz, agua, ocio, gasolina);
  for (const mes of ["2030-01", "2030-02", "2030-03"]) d.meses[mes] = { sueldo: 1000, ingresada: null };
  const gasto = (p, fecha, importe) => op.crearMovimiento(d, { tipo: "gasto", partidaId: p.id, fecha, importe });
  gasto(luz, "2030-01-10", 30);
  gasto(luz, "2030-02-10", 35);
  gasto(luz, "2030-03-10", 25);
  gasto(luz, "2030-04-10", 70);
  gasto(agua, "2030-02-15", 90);
  gasto(ocio, "2030-04-05", 20);
  return { d, luz, agua, ocio, gasolina };
}

test("área: lo mensual frente a su presupuesto, y los recibos no mensuales aparte", () => {
  const { d } = datos();
  const r = resumenArea(d, "Hogar", "2030-04", "2030-04-20");
  assert.equal(r.presupuestoMensual, 60);
  assert.equal(r.presupuesto, 90, "60 de la luz + 30 al mes del agua trimestral");
  assert.equal(r.gastadoMensual, 70);
  assert.equal(r.estado, "pasado");
  assert.deepEqual(r.aviso, { nivel: "mal", texto: "Te pasas en Luz" });
  assert.equal(r.noMensuales.length, 1);
  assert.equal(r.serie.length, 12);
  assert.deepEqual(r.serie.slice(-3).map((x) => x.gastado), [125, 25, 70]);
});

test("área: media de los meses cerrados y consejo de bajar el presupuesto", () => {
  const { d } = datos();
  const r = resumenArea(d, "Hogar", "2030-04", "2030-04-20");
  assert.equal(r.media, 60, "(30 + 125 + 25) / 3");
  assert.equal(r.mediaMensual, 30);
  assert.deepEqual(r.consejo, { tipo: "bajar", dif: -30, meses: 3 });
  assert.equal(resumenArea(d, "Ocio", "2030-04", "2030-04-20").consejo?.tipo, "bajar");
});

test("área: próximos recibos y aviso del más cercano", () => {
  const { d } = datos();
  d.movimientos = d.movimientos.filter((m) => m.fecha !== "2030-04-10");
  const r = resumenArea(d, "Hogar", "2030-04", "2030-04-20");
  assert.deepEqual(r.proximos.map((c) => c.mes).slice(0, 2), ["2030-05", "2030-08"]);
  assert.deepEqual(r.aviso, { nivel: "info", texto: "Agua en mayo" });
});

test("áreas: una por categoría en el orden del presupuesto, y el coche va a la de su combustible", () => {
  const { d, gasolina } = datos();
  assert.deepEqual(areas(d, "2030-04", "2030-04-20").map((a) => a.categoria), ["Hogar", "Ocio", "Movilidad"]);
  const { r: v } = op.crearVehiculo(d, { nombre: "Coche de prueba", kmIniciales: 1000, partidaCombustible: gasolina.id });
  assert.equal(categoriaVehiculo(d, v), "Movilidad");
  assert.deepEqual(vehiculosDeArea(d, "Movilidad").map((x) => x.id), [v.id]);
  assert.equal(esAreaDeVehiculos(d, "Movilidad"), true);
  assert.equal(esAreaDeVehiculos(d, "Transporte"), true, "Transporte siempre ofrece añadir un vehículo");
  assert.equal(esAreaDeVehiculos(d, "Ocio"), false);
  // Sin partidas, el vehículo va a Transporte (y el área aparece)
  op.crearVehiculo(d, { nombre: "Moto de prueba", kmIniciales: 10 });
  assert.ok(areas(d, "2030-04", "2030-04-20").some((a) => a.categoria === "Transporte"));
});
