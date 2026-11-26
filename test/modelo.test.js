// Pruebas de las operaciones compuestas de shared/modelo.js (gasto pagado
// desde la hucha, borrar y deshacer). Cifras inventadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { op, estadoVacio, normalizarPartida, OBJETIVO_FIJO, CUENTA_PRINCIPAL } from "../shared/modelo.js";

function preparar(saldoHucha) {
  const d = estadoVacio();
  const ibi = normalizarPartida({ nombre: "IBI", frecuencia: "Anual", importe: 400, cobroAncla: "2030-06", recibo: true });
  const comida = normalizarPartida({ nombre: "Comida", importe: 300 });
  d.partidas.push(ibi, comida);
  if (saldoHucha) op.crearMovimiento(d, { tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-05-01", importe: saldoHucha });
  return { d, ibi, comida };
}
const hucha = (d) => d.movimientos.filter((m) => m.objetivoId === OBJETIVO_FIJO.id).reduce((s, m) => s + m.importe, 0);

test("pagar un recibo no mensual desde la hucha crea la retirada enlazada", () => {
  const { d, ibi } = preparar(500);
  const { r, cambios } = op.guardarGasto(d, { tipo: "gasto", partidaId: ibi.id, fecha: "2030-06-03", importe: 400 }, { desdeHucha: true });
  assert.equal(r.deHucha, 400);
  assert.equal(r.deCuenta, 0);
  const retirada = d.movimientos.find((m) => m.id === r.enlace);
  assert.equal(retirada.importe, -400);
  assert.equal(retirada.enlace, r.id);
  assert.equal(retirada.fecha, "2030-06-03");
  assert.equal(hucha(d), 100);
  assert.equal(cambios.length, 2, "gasto y retirada van juntos en la cola");
});

test("si la hucha no llega, la diferencia sale de la cuenta", () => {
  const { d, ibi } = preparar(275);
  const { r } = op.guardarGasto(d, { tipo: "gasto", partidaId: ibi.id, fecha: "2030-06-03", importe: 400 }, { desdeHucha: true });
  assert.equal(r.deHucha, 275);
  assert.equal(r.deCuenta, 125);
  assert.equal(hucha(d), 0);
});

test("sin «Pagar desde la hucha» o en una partida mensual no hay retirada", () => {
  const { d, ibi, comida } = preparar(500);
  assert.equal(op.guardarGasto(d, { tipo: "gasto", partidaId: ibi.id, fecha: "2030-06-03", importe: 400 }, { desdeHucha: false }).r.enlace, null);
  assert.equal(op.guardarGasto(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-06-03", importe: 40 }, { desdeHucha: true }).r.enlace, null);
  assert.equal(hucha(d), 500);
});

test("corregir el gasto actualiza la retirada; quitar la opción la borra", () => {
  const { d, ibi } = preparar(500);
  const { r } = op.guardarGasto(d, { tipo: "gasto", partidaId: ibi.id, fecha: "2030-06-03", importe: 400 }, { desdeHucha: true });
  op.guardarGasto(d, { ...r, importe: 450, fecha: "2030-06-04" }, { desdeHucha: true });
  const retirada = d.movimientos.find((m) => m.id === r.enlace);
  assert.equal(retirada.importe, -450, "el saldo anterior a la retirada (500) cubre los 450");
  assert.equal(retirada.fecha, "2030-06-04");
  const g = d.movimientos.find((m) => m.id === r.id);
  op.guardarGasto(d, g, { desdeHucha: false });
  assert.equal(d.movimientos.some((m) => m.id === r.enlace), false);
  assert.equal(hucha(d), 500);
});

test("borrar uno borra los dos y deshacer los recupera juntos", () => {
  const { d, ibi } = preparar(500);
  const { r } = op.guardarGasto(d, { tipo: "gasto", partidaId: ibi.id, fecha: "2030-06-03", importe: 400 }, { desdeHucha: true });
  const antes = d.movimientos.length;
  const { r: borrado, cambios } = op.borrarMovimiento(d, r.enlace); // se borra la retirada desde el historial
  assert.equal(d.movimientos.length, antes - 2);
  assert.equal(cambios.length, 2);
  op.restaurarMovimientos(d, borrado.borrados);
  assert.equal(d.movimientos.length, antes);
  assert.equal(hucha(d), 100);
});

test("ajuste: valida la cuenta y no exige partida", () => {
  const { d } = preparar(0);
  const { r } = op.crearMovimiento(d, { tipo: "ajuste", objetivoId: CUENTA_PRINCIPAL.id, fecha: "2030-06-01", importe: -35.5, concepto: "Cuadrar con el banco" });
  assert.equal(r.importe, -35.5);
  assert.throws(() => op.crearMovimiento(d, { tipo: "ajuste", fecha: "2030-06-01", importe: 10 }), /cuenta/);
});

test("partida: guarda el mes del próximo cobro solo si no es mensual", () => {
  const { d } = preparar(0);
  const { r } = op.crearPartida(d, { nombre: "Seguro", importe: 240, frecuencia: "Semestral", cobroAncla: "2030-09" });
  assert.equal(r.cobroAncla, "2030-09");
  assert.equal(op.crearPartida(d, { nombre: "Gimnasio", importe: 30, frecuencia: "Mensual", cobroAncla: "2030-09" }).r.cobroAncla, null);
  assert.throws(() => op.crearPartida(d, { nombre: "Mal", importe: 1, frecuencia: "Anual", cobroAncla: "sept" }), /próximo cobro/);
});
