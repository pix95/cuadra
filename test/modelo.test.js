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

test("restaurar acepta null en los argumentos (así llegan desde el servidor)", () => {
  const { d, ibi } = preparar(500);
  const { r } = op.guardarGasto(d, { tipo: "gasto", partidaId: ibi.id, fecha: "2030-06-03", importe: 400 }, { desdeHucha: true });
  const { r: b } = op.borrarMovimiento(d, r.id);
  const copia = JSON.parse(JSON.stringify([b.borrados, undefined]));
  op.restaurarMovimientos(d, ...copia);
  assert.equal(hucha(d), 100);
  assert.equal(op.guardarGasto(d, { tipo: "gasto", partidaId: ibi.id, fecha: "2030-06-05", importe: 50 }, null).r.enlace, null);
});

test("nómina: guarda el día en que entró y se conserva al cambiar el importe", () => {
  const { d } = preparar(0);
  op.ponerSueldo(d, "2030-12", 1800, { ingresada: "2030-11-29" });
  assert.deepEqual(d.meses["2030-12"], { sueldo: 1800, ingresada: "2030-11-29" });
  op.ponerSueldo(d, "2030-12", 1850);
  assert.equal(d.meses["2030-12"].ingresada, "2030-11-29");
  op.ponerSueldo(d, "2030-12", 1850, { ingresada: null });
  assert.equal(d.meses["2030-12"].ingresada, null);
  assert.throws(() => op.ponerSueldo(d, "2030-12", 1850, { ingresada: "29/11" }), /fecha/);
});

test("nómina: la configuración se valida y se normaliza", () => {
  const { d } = preparar(0);
  op.guardarAjustes(d, { nomina: { importe: "1500", diaCorte: 25, pagasExtra: { meses: [12, 6, 6, 13], importe: 900 } } });
  assert.deepEqual(d.ajustes.nomina, { importe: 1500, diaCorte: 25, pagasExtra: { meses: [6, 12], importe: 900 } });
  assert.throws(() => op.guardarAjustes(d, { nomina: { diaCorte: 40 } }), /día de corte/);
});

test("mes del movimiento: solo el de la fecha o el siguiente, y el de la fecha no se guarda", () => {
  const { d, comida } = preparar(0);
  assert.equal(op.crearMovimiento(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-11-30", mes: "2030-12", importe: 80 }).r.mes, "2030-12");
  assert.equal(op.crearMovimiento(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-12-28", mes: "2031-01", importe: 80 }).r.mes, "2031-01", "cambio de año");
  assert.equal(op.crearMovimiento(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-11-30", mes: "2030-11", importe: 80 }).r.mes, null);
  assert.throws(() => op.crearMovimiento(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-11-30", mes: "2031-01", importe: 80 }), /mes de su fecha o para el siguiente/);
  assert.equal(op.crearMovimiento(d, { tipo: "ajuste", objetivoId: CUENTA_PRINCIPAL.id, fecha: "2030-11-30", mes: "2030-12", importe: 5 }).r.mes, null, "los ajustes van por su fecha");
  // Al cambiar la fecha al mes siguiente, deja de hacer falta
  const { r } = op.crearMovimiento(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-11-30", mes: "2030-12", importe: 20 });
  assert.equal(op.actualizarMovimiento(d, r.id, { fecha: "2030-12-02" }).r.mes, null);
});

test("el recibo pagado desde la hucha y su retirada cuentan para el mismo mes", () => {
  const { d, ibi } = preparar(500);
  const { r } = op.guardarGasto(d, { tipo: "gasto", partidaId: ibi.id, fecha: "2030-05-30", mes: "2030-06", importe: 400 }, { desdeHucha: true });
  assert.equal(r.mes, "2030-06");
  assert.equal(d.movimientos.find((m) => m.id === r.enlace).mes, "2030-06");
});

test("eliminar una partida con gastos: pasarlos a la hucha o borrarlos, y deshacer", () => {
  const { d, comida } = preparar(0);
  op.crearMovimiento(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-03-01", importe: 100 });
  op.crearMovimiento(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-04-01", importe: 100 });
  assert.throws(() => op.borrarPartida(d, comida.id), /archívala/);
  const { r } = op.borrarPartida(d, comida.id, { movimientos: "hucha" });
  assert.equal(d.partidas.some((p) => p.id === comida.id), false);
  assert.equal(hucha(d), 200, "los gastos pasan a ser ahorro a la hucha");
  // Deshacer: vuelve la partida y los gastos como estaban
  op.crearPartida(d, r.partida);
  op.restaurarMovimientos(d, r.antes);
  assert.equal(hucha(d), 0);
  assert.equal(d.movimientos.filter((m) => m.partidaId === comida.id && m.tipo === "gasto").length, 2);
  op.borrarPartida(d, comida.id, { movimientos: "borrar" });
  assert.equal(d.movimientos.length, 0);
});

test("partida en meses concretos: hay que elegir meses con importe", () => {
  const { d } = preparar(0);
  const { r } = op.crearPartida(d, { nombre: "Academia", frecuencia: "Meses concretos", calendario: [{ mes: 3, importe: 25 }, { mes: 5, importe: 40 }] });
  assert.equal(r.importe, 65);
  assert.equal(r.cobroAncla, null);
  assert.throws(() => op.crearPartida(d, { nombre: "Vacía", frecuencia: "Meses concretos", calendario: [] }), /al menos un mes/);
  assert.throws(() => op.crearPartida(d, { nombre: "Mal", frecuencia: "Meses concretos", calendario: [{ mes: 13, importe: 5 }] }), /mes de cobro no es válido/);
  // Pasar a otra frecuencia quita los meses
  assert.equal(op.actualizarPartida(d, r.id, { frecuencia: "Anual", importe: 100, calendario: null }).r.calendario, null);
});

test("empezar de cero: borra la historia y conserva la configuración", () => {
  const { d, comida } = preparar(300);
  op.ponerSueldo(d, "2030-05", 1500, { ingresada: "2030-04-28" });
  op.crearMovimiento(d, { tipo: "gasto", partidaId: comida.id, fecha: "2030-05-03", importe: 20 });
  const { r: o } = op.crearObjetivo(d, { nombre: "Viaje", meta: 500 });
  const { r, cambios } = op.empezarDeCero(d);
  assert.deepEqual([r.movimientos, r.meses], [2, 1]);
  assert.deepEqual([d.movimientos.length, Object.keys(d.meses).length], [0, 0]);
  assert.equal(d.partidas.length, 2, "las partidas se quedan");
  assert.equal(d.objetivos[0].id, o.id, "los objetivos se quedan");
  assert.ok(cambios.every((c) => c.tipo === "delete"));
})
