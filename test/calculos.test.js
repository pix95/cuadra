// Pruebas de los cálculos de la 2.1 (cuenta principal con arrastre y recibos
// no mensuales con calendario). Todas las cifras son inventadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resumenMes, saldoCuentaAl, primerMesCuenta, propuestaCierre, cobraEnMes, proximosCobros, calendarioCobros,
  aportacionHucha, recibosNoMensualesMes, partidasFrecuentes, ahorradoObjetivo, evolucionAhorro, alertas,
  mesDeNomina, importeNomina, nominaDeHoy, adelantadoAlBanco, reciboHucha, partidaHuchaDuplicada, mesEnCurso, mesPropuesto, analisisPeriodo,
  prorrateo, OBJETIVO_FIJO, AHORRO_PRINCIPAL, CUENTA_PRINCIPAL,
} from "../src/lib/calculos.js";
import { normalizarPartida } from "../shared/modelo.js";
import { r2 } from "../src/lib/formato.js";

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

test("próximo cobro: se salta los de este mes ya pagados", () => {
  const agua = partida({ nombre: "Agua", frecuencia: "Bimestral", importe: 30, cobroAncla: "2030-01" });
  const ibi = partida({ nombre: "IBI", frecuencia: "Anual", importe: 400, cobroAncla: "2030-03" });
  const db = base({ partidas: [agua, ibi], movimientos: [mov({ partidaId: agua.id, fecha: "2030-01-04", importe: 30 })] });
  const h = aportacionHucha(db, "2030-01");
  assert.equal(h.proximo.partida.nombre, "Agua");
  assert.equal(h.proximo.mes, "2030-03", "el agua de enero ya está pagada: el siguiente es en marzo");
});

test("sugerida y estado tienen en cuenta los ajustes y retiradas a mano del mes", () => {
  const p = partida({ frecuencia: "Anual", importe: 600, cobroAncla: "2030-06" });
  const movs = [
    mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2029-12-01", importe: 300 }),
    mov({ tipo: "ajuste", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-01-10", importe: -100 }), // cuadrar con el banco
  ];
  const h = aportacionHucha(base({ partidas: [p], movimientos: movs }), "2030-01");
  assert.equal(h.saldo, 200);
  assert.equal(h.estado, -100);
  assert.equal(h.sugerida, 66.67); // (600 − 200) / 6
});

test("nómina: siempre cuenta para el mes siguiente", () => {
  assert.equal(mesDeNomina("2030-11-29"), "2030-12");
  assert.equal(mesDeNomina("2030-11-19"), "2030-12", "siempre la del mes siguiente");
  assert.equal(mesDeNomina("2030-12-28"), "2031-01");
});

test("nómina: importe propuesto con la paga extra y la de hoy", () => {
  const db = { ...base(), ajustes: { nombre: "", sueldoSugerido: 1400, nomina: { importe: 1500, diaCorte: 25, pagasExtra: { meses: [6, 12], importe: 700 } } } };
  assert.deepEqual(importeNomina(db, "2030-12"), { base: 1500, extra: 700, total: 2200 });
  assert.equal(importeNomina(db, "2030-11").total, 1500);
  assert.equal(nominaDeHoy(db, "2030-11-24").mes, "2030-12");
  db.meses["2030-12"] = { sueldo: 2200, ingresada: "2030-11-27" };
  assert.deepEqual(nominaDeHoy(db, "2030-11-27"), { mes: "2030-12", sueldo: 2200, ingresada: "2030-11-27" });
});

test("con la nómina de diciembre ingresada, diciembre es el mes en curso", () => {
  const db = base();
  db.meses["2030-11"] = { sueldo: 1000, ingresada: "2030-10-30" };
  db.meses["2030-12"] = { sueldo: 1200, ingresada: "2030-11-28" };
  assert.equal(mesEnCurso(db, "2030-11-27"), "2030-11");
  assert.equal(mesEnCurso(db, "2030-11-28"), "2030-12");
  assert.equal(mesEnCurso(db, "2030-12-05"), "2030-12");
  assert.equal(resumenMes(db, "2030-11", "2030-11-29").fase, "pasado");
  assert.equal(resumenMes(db, "2030-12", "2030-11-29").fase, "actual");
  assert.equal(mesPropuesto(db, "2030-11-29"), "2030-12");
  assert.equal(mesPropuesto(db, "2030-11-27"), "2030-11", "antes de que entre la nómina");
});

test("un gasto del 30 de noviembre que cuenta para diciembre: sale de diciembre y el banco cuadra", () => {
  const comida = partida({ nombre: "Comida", importe: 300 });
  const db = base({ partidas: [comida] });
  db.meses["2030-11"] = { sueldo: 1000, ingresada: "2030-10-30" };
  db.meses["2030-12"] = { sueldo: 1200, ingresada: "2030-11-28" };
  db.movimientos.push(mov({ partidaId: comida.id, fecha: "2030-11-10", importe: 300 }));
  db.movimientos.push(mov({ partidaId: comida.id, fecha: "2030-11-30", mes: "2030-12", importe: 100 }));
  const nov = resumenMes(db, "2030-11", "2030-11-30");
  const dic = resumenMes(db, "2030-12", "2030-11-30");
  assert.equal(nov.gastado, 300);
  assert.equal(dic.gastado, 100);
  assert.equal(dic.gp.get(comida.id), 100, "cuenta en la partida de diciembre");
  // En el banco: 1000 − 300 + 1200 − 100 = 1800, lo mismo que el saldo de diciembre
  assert.equal(dic.saldoCuenta, 1800);
  assert.equal(adelantadoAlBanco(db, "2030-11-30").total, 0);
  assert.equal(analisisPeriodo(db, "mes", "2030-12-01", "2030-11-30").total, 100);
  assert.equal(analisisPeriodo(db, "mes", "2030-11-01", "2030-11-30").total, 300);
});

test("cuadrar con el banco suma lo que ya ha pasado por el banco y cuenta para un mes que no ha empezado", () => {
  const comida = partida({ nombre: "Comida", importe: 300 });
  const db = base({ partidas: [comida] });
  db.meses["2030-11"] = { sueldo: 1000, ingresada: "2030-10-30" };
  // Un gasto apuntado a mano para diciembre antes de que entre su nómina
  db.movimientos.push(mov({ partidaId: comida.id, fecha: "2030-11-26", mes: "2030-12", importe: 40 }));
  assert.equal(mesEnCurso(db, "2030-11-26"), "2030-11");
  assert.deepEqual(adelantadoAlBanco(db, "2030-11-26"), { lista: [{ mes: "2030-12", tipo: "movimientos", importe: -40 }], total: -40 });
  db.meses["2030-12"] = { sueldo: 1200, ingresada: "2031-01-02" }; // con fecha futura aún no está en el banco
  assert.equal(adelantadoAlBanco(db, "2030-11-26").total, -40);
});

test("lo apartado a la hucha el 30 de noviembre para diciembre cuenta como aportación de diciembre", () => {
  const db = base();
  db.movimientos.push(mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-10-15", importe: 50 }));
  db.movimientos.push(mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-11-30", mes: "2030-12", importe: 30 }));
  const dic = aportacionHucha(db, "2030-12");
  assert.deepEqual([dic.saldoInicio, dic.apartadoMes], [50, 30]);
  assert.equal(aportacionHucha(db, "2030-11").apartadoMes, 0);
});

test("la hucha calcula con el mes en curso: diciembre en cuanto entra su nómina", () => {
  const db = base();
  db.meses["2030-12"] = { sueldo: 1200, ingresada: "2030-11-28" };
  db.movimientos.push(mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-11-29", mes: "2030-12", importe: 40 }));
  const real = Date;
  globalThis.Date = class extends real {
    constructor(...a) {
      super(...(a.length ? a : ["2030-11-29T12:00:00"]));
    }
  };
  try {
    assert.equal(aportacionHucha(db).apartadoMes, 40, "sin mes, cuenta lo de diciembre");
  } finally {
    globalThis.Date = real;
  }
});

test("apartar a la hucha como un recibo del mes: lo que falta y cuándo está hecho", () => {
  const ibi = partida({ nombre: "Recibo anual", importe: 1200, frecuencia: "Anual", recibo: true });
  const db = base({ partidas: [ibi, partida({ nombre: "Recibos no mensuales (a mano)", importe: 100, recibo: true })] });
  const r = reciboHucha(db, "2030-03");
  assert.deepEqual([r.sugerida, r.apartado, r.falta, r.hecho], [100, 0, 100, false]);
  db.movimientos.push(mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-03-05", importe: 60 }));
  assert.equal(reciboHucha(db, "2030-03").falta, 40);
  db.movimientos.push(mov({ tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, fecha: "2030-03-20", importe: 40 }));
  assert.equal(reciboHucha(db, "2030-03").hecho, true);
  assert.equal(partidaHuchaDuplicada(db)?.nombre, "Recibos no mensuales (a mano)");
});

test("meses concretos: cada mes con su importe (matrícula y cuotas en meses sueltos)", () => {
  const academia = normalizarPartida({ id: id(), nombre: "Academia", frecuencia: "Meses concretos", recibo: true, calendario: [{ mes: 7, importe: 40 }, { mes: 3, importe: 25 }, { mes: 11, importe: 40 }, { mes: 5, importe: 40 }] });
  assert.equal(academia.importe, 145, "el importe es el total del año");
  assert.equal(r2(prorrateo(academia)), 12.08);
  assert.deepEqual(proximosCobros(academia, "2030-06", 4), ["2030-07", "2030-11", "2031-03", "2031-05"]);
  const db = base({ partidas: [academia] });
  assert.deepEqual(recibosNoMensualesMes(db, "2031-03").map((x) => x.partida.importe), [25]);
  assert.deepEqual(recibosNoMensualesMes(db, "2031-02"), []);
  assert.deepEqual(calendarioCobros(db, "2030-12", 12).map((c) => [c.mes, c.importe]), [["2031-03", 25], ["2031-05", 40], ["2031-07", 40], ["2031-11", 40]]);
  assert.equal(aportacionHucha(db, "2030-12").sinFecha, 0, "la hucha sabe cuándo cobra");
});
