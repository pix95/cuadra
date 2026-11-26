// Pruebas de los cálculos de la 2.1 (cuenta principal con arrastre y recibos
// no mensuales con calendario). Todas las cifras son inventadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resumenMes, saldoCuentaAl, primerMesCuenta, propuestaCierre, cobraEnMes, proximosCobros, calendarioCobros,
  aportacionHucha, recibosNoMensualesMes, partidasFrecuentes, ahorradoObjetivo, evolucionAhorro, alertas,
  OBJETIVO_FIJO, AHORRO_PRINCIPAL, CUENTA_PRINCIPAL,
} from "../src/lib/calculos.js";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const partida = (x) => ({ id: id(), nombre: "Partida", categoria: "Otros", importe: 0, frecuencia: "Mensual", recibo: false, icono: "paquete", orden: n, activa: true, cobroAncla: null, ...x });
const mov = (x) => ({ id: id(), tipo: "gasto", fecha: "2030-01-10", importe: 0, partidaId: null, objetivoId: null, concepto: "", enlace: null, ...x });
const base = (x = {}) => ({ ajustes: {}, partidas: [], meses: {}, movimientos: [], objetivos: [], simulaciones: [], ...x });

// ---------- Calendario ----------
test("calendario: cobros desde el ancla según la frecuencia", () => {
  const p = partida({ frecuencia: "Bimestral", importe: 40, cobroAncla: "2030-06" });
  assert.equal(cobraEnMes(p, "2030-05"), false, "antes del ancla no hay cobro");
  assert.equal(cobraEnMes(p, "2030-06"), true);
  assert.equal(cobraEnMes(p, "2030-07"), false);
  assert.equal(cobraEnMes(p, "2030-08"), true);
  assert.deepEqual(proximosCobros(p, "2030-07", 3), ["2030-08", "2030-10", "2030-12"]);
  const anual = partida({ frecuencia: "Anual", importe: 300, cobroAncla: "2030-03" });
  assert.deepEqual(proximosCobros(anual, "2030-04", 2), ["2031-03", "2032-03"]);
  assert.equal(cobraEnMes(partida({ frecuencia: "Anual", importe: 300 }), "2030-03"), false, "sin ancla no tiene fecha");
});

test("calendario: los próximos 12 meses ordenados", () => {
  const db = base({
    partidas: [
      partida({ nombre: "A", frecuencia: "Semestral", importe: 100, cobroAncla: "2030-02" }),
      partida({ nombre: "B", frecuencia: "Anual", importe: 200, cobroAncla: "2030-05" }),
    ],
  });
  const c = calendarioCobros(db, "2030-01", 12);
  assert.deepEqual(c.map((x) => [x.mes, x.partida.nombre]), [["2030-02", "A"], ["2030-05", "B"], ["2030-08", "A"]]);
});

// ---------- Aportación sugerida ----------
test("sugerida: 1.240 € a 8 meses con saldo 0 → 155 €/mes", () => {
  // El cobro cae en el 8.º mes de aportación contando el actual (enero → agosto)
  const db = base({ partidas: [partida({ frecuencia: "Anual", importe: 1240, cobroAncla: "2030-08" })] });
  const h = aportacionHucha(db, "2030-01");
  assert.equal(h.sugerida, 155);
  assert.equal(h.saldo, 0);
  assert.equal(h.proximo.mes, "2030-08");
  assert.equal(h.proximo.importe, 1240);
});

test("sugerida: si un mes apartas más, la siguiente baja; si apartas menos, sube", () => {
  const p = partida({ frecuencia: "Anual", importe: 1240, cobroAncla: "2030-08" });
  const aporte = (importe) => mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-01-05", importe });
  const mas = aportacionHucha(base({ partidas: [p], movimientos: [aporte(240)] }), "2030-02").sugerida;
  const menos = aportacionHucha(base({ partidas: [p], movimientos: [aporte(100)] }), "2030-02").sugerida;
  assert.equal(mas, 142.86); // (1240 − 240) / 7
  assert.equal(menos, 162.86); // (1240 − 100) / 7
});

test("sugerida: los recibos sin fecha suman su prorrateo", () => {
  const db = base({
    partidas: [
      partida({ frecuencia: "Anual", importe: 1240, cobroAncla: "2030-08" }),
      partida({ frecuencia: "Anual", importe: 120 }), // sin fecha: 10 €/mes
    ],
  });
  assert.equal(aportacionHucha(db, "2030-01").sugerida, 165);
});

test("estado: al día, adelantado y por detrás", () => {
  // 600 € anuales en junio: prorrateo 50 €/mes. A principio de enero hacen falta 300 € (600 − 50·6)
  const p = partida({ frecuencia: "Anual", importe: 600, cobroAncla: "2030-06" });
  const aporte = (fecha, importe) => mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha, importe });
  assert.equal(aportacionHucha(base({ partidas: [p], movimientos: [aporte("2029-12-01", 300)] }), "2030-01").estado, 0);
  // Apartar este mes el prorrateo no cambia el estado; pasarse, sí
  assert.equal(aportacionHucha(base({ partidas: [p], movimientos: [aporte("2029-12-01", 300), aporte("2030-01-02", 50)] }), "2030-01").estado, 0);
  assert.equal(aportacionHucha(base({ partidas: [p], movimientos: [aporte("2029-12-01", 300), aporte("2030-01-02", 80)] }), "2030-01").estado, 30);
  assert.equal(aportacionHucha(base({ partidas: [p], movimientos: [aporte("2029-12-01", 200)] }), "2030-01").estado, -100);
});

test("próximo cobro: avisa si la hucha no llega", () => {
  const p = partida({ nombre: "IBI", frecuencia: "Anual", importe: 500, cobroAncla: "2030-02" });
  const db = base({ partidas: [p], meses: { "2030-01": { sueldo: 2000 } } });
  const h = aportacionHucha(db, "2030-01");
  assert.equal(h.proximo.meses, 1);
  assert.equal(h.proximo.cubierto, false);
  assert.ok(alertas(db, "2030-01", "2030-01-15").some((a) => a.tipo === "hucha" && a.nivel === "mal"));
});

test("recibos no mensuales del mes según el calendario", () => {
  const agua = partida({ nombre: "Agua", frecuencia: "Bimestral", importe: 40, cobroAncla: "2030-01", recibo: true });
  const db = base({ partidas: [agua], movimientos: [mov({ partidaId: agua.id, fecha: "2030-03-04", importe: 41 })] });
  assert.equal(recibosNoMensualesMes(db, "2030-02").length, 0);
  assert.deepEqual(recibosNoMensualesMes(db, "2030-03").map((x) => [x.partida.nombre, x.hecho]), [["Agua", true]]);
  assert.deepEqual(recibosNoMensualesMes(db, "2030-05").map((x) => x.hecho), [false]);
});

test("previsión: los no mensuales cuentan como sugerida − lo ya apartado", () => {
  const p = partida({ frecuencia: "Anual", importe: 1240, cobroAncla: "2030-08" });
  const db = base({ partidas: [p], meses: { "2030-01": { sueldo: 1000 } } });
  assert.equal(resumenMes(db, "2030-01", "2030-01-15").prevision, 845); // 1000 − 155
  db.movimientos.push(mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-01-02", importe: 100 }));
  // Ya apartados 100: quedan 900 en la cuenta y faltan 55 por apartar
  assert.equal(resumenMes(db, "2030-01", "2030-01-15").prevision, 845);
});

// ---------- Cuenta principal con arrastre ----------
test("arrastre: lo que sobra un mes pasa al siguiente (también en negativo)", () => {
  const comida = partida({ nombre: "Comida", importe: 300 });
  const db = base({
    partidas: [comida],
    meses: { "2030-01": { sueldo: 1000 }, "2030-02": { sueldo: 1000 }, "2030-03": { sueldo: 1000 } },
    movimientos: [
      mov({ partidaId: comida.id, fecha: "2030-01-10", importe: 880 }), // sobran 120
      mov({ partidaId: comida.id, fecha: "2030-02-10", importe: 1200 }), // faltan 200
      mov({ tipo: "ahorro", objetivoId: AHORRO_PRINCIPAL.id, fecha: "2030-02-11", importe: 50 }),
      mov({ tipo: "ahorro", objetivoId: AHORRO_PRINCIPAL.id, fecha: "2030-02-12", importe: -20 }), // retirada: vuelve a la cuenta
    ],
  });
  assert.equal(saldoCuentaAl(db, "2030-01"), 120);
  const feb = resumenMes(db, "2030-02", "2030-02-20");
  assert.equal(feb.arrastre, 120);
  assert.equal(feb.disponible, -230);
  assert.equal(feb.saldoCuenta, -110);
  const mar = resumenMes(db, "2030-03", "2030-03-05");
  assert.equal(mar.arrastre, -110);
  assert.equal(mar.saldoCuenta, 890);
});

test("arrastre: empieza en el primer mes con sueldo e incluye los ajustes", () => {
  const p = partida({});
  const db = base({
    partidas: [p],
    meses: { "2030-03": { sueldo: 1000 } },
    movimientos: [
      mov({ partidaId: p.id, fecha: "2030-01-10", importe: 500 }), // mes sin sueldo (versión antigua): no cuenta
      mov({ tipo: "ajuste", objetivoId: CUENTA_PRINCIPAL.id, fecha: "2030-03-01", importe: 250 }), // saldo inicial
      mov({ partidaId: p.id, fecha: "2030-03-10", importe: 100 }),
    ],
  });
  assert.equal(primerMesCuenta(db, "2030-03-20"), "2030-03");
  const r = resumenMes(db, "2030-03", "2030-03-20");
  assert.equal(r.arrastre, 0);
  assert.equal(r.ajustesMes, 250);
  assert.equal(r.disponible, 900, "el ajuste no cuenta como ingreso del mes");
  assert.equal(r.saldoCuenta, 1150);
});

test("propuesta de cierre: como mucho lo que sobró, sin pasar del saldo de la cuenta", () => {
  const p = partida({});
  const meses = { "2030-01": { sueldo: 1000 }, "2030-02": { sueldo: 1000 } };
  // Enero: faltan 300. Febrero: sobran 200, pero la cuenta cierra en −100
  const db = base({
    partidas: [p],
    meses,
    movimientos: [mov({ partidaId: p.id, fecha: "2030-01-05", importe: 1300 }), mov({ partidaId: p.id, fecha: "2030-02-05", importe: 800 })],
  });
  assert.equal(propuestaCierre(db, "2030-03-02"), null);
  // Con un ajuste de 500 € en la cuenta, cierra en 400: se proponen los 200 que sobraron
  db.movimientos.push(mov({ tipo: "ajuste", objetivoId: CUENTA_PRINCIPAL.id, fecha: "2030-01-01", importe: 500 }));
  assert.equal(propuestaCierre(db, "2030-03-02").importe, 200);
});

// ---------- Cuentas de ahorro ----------
test("saldo de una cuenta: aportaciones − retiradas + ajustes (y los antiguos «inicial»)", () => {
  const db = base({
    movimientos: [
      mov({ tipo: "inicial", fecha: "2030-01-01", importe: 1000 }),
      mov({ tipo: "ahorro", objetivoId: AHORRO_PRINCIPAL.id, fecha: "2030-01-05", importe: 200 }),
      mov({ tipo: "ajuste", objetivoId: AHORRO_PRINCIPAL.id, fecha: "2030-01-06", importe: -50 }),
    ],
  });
  assert.equal(ahorradoObjetivo(db, AHORRO_PRINCIPAL.id), 1150);
});

test("evolución del ahorro: no cuenta las retiradas para pagar recibos", () => {
  const db = base({
    meses: { "2030-01": { sueldo: 1000 } },
    movimientos: [
      mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-01-02", importe: 150 }),
      mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-01-20", importe: -100, enlace: id() }),
    ],
  });
  assert.equal(evolucionAhorro(db, "2030-01", 1)[0].ahorrado, 150);
});

test("accesos rápidos: sin recibos", () => {
  const luz = partida({ nombre: "Luz", recibo: true, importe: 50 });
  const comida = partida({ nombre: "Comida", importe: 300 });
  const db = base({ partidas: [luz, comida], movimientos: [mov({ partidaId: luz.id, fecha: "2030-01-05", importe: 50 })] });
  assert.deepEqual(partidasFrecuentes(db, 8, "2030-01-10").map((p) => p.nombre), ["Comida"]);
});
