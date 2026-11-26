// Cálculos del presupuesto. Todo es puro: recibe los datos y devuelve cifras.
import { r2, sum, diasEnMes, fechaDe, iso, sumarDias, moverMes, hoyISO } from "./formato.js";
import { OBJETIVO_FIJO, AHORRO_PRINCIPAL, CUENTA_PRINCIPAL, objetivosConFijo, cuentas, cuentaDeAjuste } from "../../shared/modelo.js";
export { OBJETIVO_FIJO, AHORRO_PRINCIPAL, CUENTA_PRINCIPAL, objetivosConFijo, cuentas, cuentaDeAjuste };

export const FRECUENCIAS = ["Mensual", "Bimestral", "Trimestral", "Semestral", "Anual"];
export const VECES = { Mensual: 12, Bimestral: 6, Trimestral: 4, Semestral: 2, Anual: 1 };
export const CADA = { Mensual: "cada mes", Bimestral: "cada 2 meses", Trimestral: "cada 3 meses", Semestral: "cada 6 meses", Anual: "una vez al año" };

export const esMensual = (p) => p.frecuencia === "Mensual";
export const prorrateo = (p) => (p.importe * VECES[p.frecuencia]) / 12;
export const anual = (p) => p.importe * VECES[p.frecuencia];
// Lo que una partida "cuesta" en un mes: su importe si es mensual, o la parte
// que toca apartar si es periódica.
export const previstoMes = (p) => (esMensual(p) ? p.importe : prorrateo(p));

export const ordenar = (ps) => [...ps].sort((a, b) => a.orden - b.orden);

export function presupuestoMensual(partidas) {
  const activas = partidas.filter((p) => p.activa);
  const mensual = r2(sum(activas.filter(esMensual), (p) => p.importe));
  const periodico = r2(sum(activas.filter((p) => !esMensual(p)), prorrateo));
  const recibos = r2(sum(activas.filter((p) => esMensual(p) && p.recibo), (p) => p.importe));
  return { mensual, periodico, recibos, variable: r2(mensual - recibos), total: r2(mensual + periodico), anual: r2(sum(activas, anual)) };
}

export function estadoDe(gastado, pres) {
  gastado = r2(gastado);
  if (pres <= 0) return gastado > 0 ? "pasado" : "ok";
  if (Math.abs(gastado - pres) < 0.01) return "completo";
  const x = gastado / pres;
  return x > 1 ? "pasado" : x >= 0.85 ? "cerca" : "ok";
}
export const porcentaje = (g, p) => (p > 0 ? Math.max(0, Math.min(100, (g / p) * 100)) : g > 0 ? 100 : 0);

export function ordenCategorias(partidas) {
  const out = [];
  ordenar(partidas).forEach((p) => {
    if (!out.includes(p.categoria)) out.push(p.categoria);
  });
  return out;
}

// Los ajustes ("Cuadrar con el banco", y los antiguos "inicial") cambian el
// saldo de una cuenta pero no son gasto, ingreso ni ahorro de ningún mes.
export const esAjuste = (m) => m.tipo === "ajuste" || m.tipo === "inicial";
export const movsDeMes = (db, mes) => db.movimientos.filter((m) => !esAjuste(m) && m.fecha.startsWith(mes));

export function gastosPorPartida(movs, partidas) {
  const ids = new Set(partidas.map((p) => p.id));
  const out = new Map();
  for (const m of movs) {
    if (m.tipo !== "gasto") continue;
    const k = ids.has(m.partidaId) ? m.partidaId : "_sin";
    out.set(k, (out.get(k) || 0) + m.importe);
  }
  return out;
}

export function faseMes(mes, hoy = hoyISO()) {
  const actual = hoy.slice(0, 7);
  return mes < actual ? "pasado" : mes > actual ? "futuro" : "actual";
}

// Resumen de un mes: lo que entra, lo que sale y cómo acabará si gastas lo previsto.
export function resumenMes(db, mes, hoy = hoyISO()) {
  const movs = movsDeMes(db, mes);
  const sueldo = db.meses[mes]?.sueldo ?? null;
  const gastado = r2(sum(movs.filter((m) => m.tipo === "gasto"), (m) => m.importe));
  const ingresos = r2(sum(movs.filter((m) => m.tipo === "ingreso"), (m) => m.importe));
  const ahorrado = r2(sum(movs.filter((m) => m.tipo === "ahorro"), (m) => m.importe));
  const gp = gastosPorPartida(movs, db.partidas);

  const entradas = r2((sueldo ?? 0) + ingresos);
  const disponible = r2(entradas - gastado - ahorrado);

  // Lo que todavía falta por salir según el presupuesto (nunca negativo por partida).
  // Los recibos no mensuales cuentan como lo que toca apartar este mes a la hucha
  // (la aportación sugerida) menos lo que ya has apartado.
  let pendienteMensual = 0;
  for (const p of db.partidas) {
    if (!p.activa || !esMensual(p)) continue;
    pendienteMensual += Math.max(0, p.importe - (gp.get(p.id) || 0));
  }
  const hucha = aportacionHucha(db, mes);
  const pendiente = r2(pendienteMensual + Math.max(0, hucha.sugerida - hucha.apartadoMes));
  const prevision = r2(disponible - pendiente);

  // La cuenta principal arrastra lo que sobró (o faltó) de los meses anteriores
  const arrastre = saldoCuentaAl(db, moverMes(mes, -1), hoy);
  const ajustesMes = r2(sum(db.movimientos.filter((m) => m.tipo === "ajuste" && m.objetivoId === CUENTA_PRINCIPAL.id && m.fecha.startsWith(mes)), (m) => m.importe));
  const delMes = mes >= primerMesCuenta(db, hoy) ? disponible : 0;
  const saldoCuenta = r2(arrastre + delMes + ajustesMes);

  const pres = presupuestoMensual(db.partidas);
  const dias = diasEnMes(mes);
  const fase = faseMes(mes, hoy);
  const dia = fase === "actual" ? Number(hoy.slice(8, 10)) : fase === "pasado" ? dias : 0;

  // Saldo del mes día a día (para la línea de la tarjeta)
  const porDia = new Array(dias + 1).fill(0);
  for (const m of movs) {
    const d = Number(m.fecha.slice(8, 10));
    porDia[d] += m.tipo === "ingreso" ? m.importe : -m.importe;
  }
  const serie = [];
  let saldo = arrastre + (sueldo ?? 0);
  for (let d = 1; d <= Math.max(1, dia); d++) {
    saldo += porDia[d];
    serie.push(r2(saldo));
  }

  return {
    mes, sueldo, gastado, ingresos, ahorrado, entradas, disponible, pendiente, prevision,
    arrastre, ajustesMes, saldoCuenta, hucha,
    presupuesto: pres, gp, fase, dias, dia, serie, movs,
    gastadoPct: entradas > 0 ? ((gastado + ahorrado) / entradas) * 100 : 0,
    ahorroPct: entradas > 0 ? (prevision / entradas) * 100 : 0,
  };
}

// Recibos mensuales (cargos que llegan una vez al mes) y si ya están pagados
export function recibosMes(db, mes) {
  const gp = gastosPorPartida(movsDeMes(db, mes), db.partidas);
  return ordenar(db.partidas.filter((p) => p.activa && p.recibo && esMensual(p) && p.importe > 0)).map((p) => {
    const pagado = r2(gp.get(p.id) || 0);
    return { partida: p, pagado, hecho: pagado > 0 };
  });
}

// Recibos no mensuales que vencen en un mes según su calendario
export function recibosNoMensualesMes(db, mes) {
  const gp = gastosPorPartida(movsDeMes(db, mes), db.partidas);
  return ordenar(db.partidas.filter((p) => p.activa && !esMensual(p) && p.importe > 0 && cobraEnMes(p, mes))).map((p) => {
    const pagado = r2(gp.get(p.id) || 0);
    return { partida: p, pagado, hecho: pagado > 0 };
  });
}

// Gastos de cada partida periódica en lo que va de año (hasta el mes indicado)
export function acumuladoAño(db, mes) {
  const año = mes.slice(0, 4);
  const movs = db.movimientos.filter((m) => m.tipo === "gasto" && m.fecha.startsWith(año) && m.fecha.slice(0, 7) <= mes);
  return gastosPorPartida(movs, db.partidas);
}

// Saldo de una cuenta de ahorro: lo apartado − lo retirado + los ajustes
// (con "hasta", solo los movimientos anteriores a esa fecha)
export function ahorradoObjetivo(db, id, hasta = null) {
  return r2(
    sum(
      db.movimientos.filter(
        (m) => ((m.tipo === "ahorro" && m.objetivoId === id) || (esAjuste(m) && cuentaDeAjuste(m) === id)) && (!hasta || m.fecha < hasta)
      ),
      (m) => m.importe
    )
  );
}

// Partidas más usadas en los últimos 90 días (para los accesos rápidos).
// Los recibos no salen: se marcan desde «Recibos del mes» (y siguen en «Todas»).
export function partidasFrecuentes(db, n = 8, hoy = hoyISO()) {
  const limite = sumarDias(hoy, -90);
  const cuenta = new Map();
  db.movimientos.forEach((m) => {
    if (m.tipo === "gasto" && m.fecha >= limite) cuenta.set(m.partidaId, (cuenta.get(m.partidaId) || 0) + 1);
  });
  const elegibles = db.partidas.filter((p) => p.activa && !p.recibo);
  const ids = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => elegibles.some((p) => p.id === id));
  // Si aún hay pocos datos, se completan con las partidas mensuales y luego el resto
  for (const p of ordenar(elegibles.filter(esMensual))) if (!ids.includes(p.id)) ids.push(p.id);
  for (const p of ordenar(elegibles)) if (!ids.includes(p.id)) ids.push(p.id);
  return ids.slice(0, n).map((id) => elegibles.find((p) => p.id === id));
}

// Avisos para la campana
export function alertas(db, mes, hoy = hoyISO()) {
  const r = resumenMes(db, mes, hoy);
  const out = [];
  if (r.sueldo == null && r.fase !== "pasado") out.push({ nivel: "info", tipo: "sueldo", texto: "Aún no has elegido el sueldo de este mes." });
  for (const p of ordenar(db.partidas.filter((p) => p.activa && esMensual(p)))) {
    const g = r.gp.get(p.id) || 0;
    const e = estadoDe(g, p.importe);
    if (e === "pasado") out.push({ nivel: "mal", tipo: "partida", partida: p, texto: `Te has pasado ${eurTxt(g - p.importe)} en ${p.nombre}.` });
    else if (e === "cerca" && !p.recibo) out.push({ nivel: "aviso", tipo: "partida", partida: p, texto: `Llevas el ${Math.round((g / p.importe) * 100)} % de ${p.nombre}.` });
  }
  if (r.fase !== "pasado") {
    const pend = recibosMes(db, mes).filter((x) => !x.hecho);
    if (pend.length) out.push({ nivel: "info", tipo: "recibos", texto: `${pend.length} ${pend.length === 1 ? "recibo pendiente" : "recibos pendientes"} este mes (${eurTxt(sum(pend, (x) => x.partida.importe))}).` });
    if (r.sueldo != null && r.prevision < 0) out.push({ nivel: "mal", tipo: "prevision", texto: `Con lo previsto acabarías el mes en ${eurTxt(r.prevision)}.` });
    const pendNM = recibosNoMensualesMes(db, mes).filter((x) => !x.hecho);
    if (pendNM.length)
      out.push({
        nivel: "info",
        tipo: "recibos",
        texto: `${pendNM.length === 1 ? `${pendNM[0].partida.nombre} vence` : `${pendNM.length} recibos no mensuales vencen`} este mes (${eurTxt(sum(pendNM, (x) => x.partida.importe))}).`,
      });
    const h = r.hucha;
    if (h.proximo && h.proximo.meses <= 1 && !h.proximo.cubierto)
      out.push({
        nivel: "mal",
        tipo: "hucha",
        texto: `La hucha no llega a ${h.proximo.partida.nombre} (${eurTxt(h.proximo.importe)}, ${h.proximo.meses === 0 ? "este mes" : "el mes que viene"}).`,
      });
    else if (h.estado < -1) out.push({ nivel: "aviso", tipo: "hucha", texto: `La hucha de recibos no mensuales va ${eurTxt(-h.estado)} por detrás.` });
  }
  return out;
}
const eurTxt = (n) => `${n < 0 ? "−" : ""}${Math.abs(r2(n)).toFixed(2).replace(".", ",")} €`;

// ---------- Periodos para el análisis ----------
export function rangoPeriodo(tipo, ancla) {
  if (tipo === "mes") {
    const mes = ancla.slice(0, 7);
    return { inicio: `${mes}-01`, fin: `${mes}-${String(diasEnMes(mes)).padStart(2, "0")}` };
  }
  if (tipo === "año") {
    const y = ancla.slice(0, 4);
    return { inicio: `${y}-01-01`, fin: `${y}-12-31` };
  }
  const d = fechaDe(ancla);
  const lunes = sumarDias(ancla, -((d.getDay() + 6) % 7));
  return { inicio: lunes, fin: sumarDias(lunes, 6) };
}

export function moverPeriodo(tipo, ancla, delta) {
  if (tipo === "mes") return `${moverMes(ancla.slice(0, 7), delta)}-01`;
  if (tipo === "año") return `${Number(ancla.slice(0, 4)) + delta}-01-01`;
  return sumarDias(ancla, 7 * delta);
}

const diasEntre = (a, b) => Math.round((fechaDe(b) - fechaDe(a)) / 864e5);

// Gastos de un periodo, comparados con el anterior y con el presupuesto
export function analisisPeriodo(db, tipo, ancla, hoy = hoyISO()) {
  const { inicio, fin } = rangoPeriodo(tipo, ancla);
  const gastos = db.movimientos.filter((m) => m.tipo === "gasto");
  const enRango = (a, b) => gastos.filter((m) => m.fecha >= a && m.fecha <= b);
  const movs = enRango(inicio, fin);
  const total = r2(sum(movs, (m) => m.importe));
  const enCurso = hoy >= inicio && hoy <= fin;
  const futuro = hoy < inicio;

  // Periodo anterior, cortado en el mismo punto si este está a medias
  const ant = rangoPeriodo(tipo, moverPeriodo(tipo, ancla, -1));
  let finAnt = ant.fin;
  if (enCurso) {
    const corte = sumarDias(ant.inicio, diasEntre(inicio, hoy));
    if (corte < finAnt) finAnt = corte;
  }
  const totalAnt = r2(sum(enRango(ant.inicio, finAnt), (m) => m.importe));

  const pres = presupuestoMensual(db.partidas);
  const presupuesto = tipo === "mes" ? pres.total : tipo === "año" ? pres.anual : r2((pres.total * 12) / 365 * 7);

  // Barras y media: solo el gasto variable (los recibos caen de golpe y lo deforman)
  const esRecibo = new Set(db.partidas.filter((p) => p.recibo).map((p) => p.id));
  const variables = movs.filter((m) => !esRecibo.has(m.partidaId));
  const totalVariable = r2(sum(variables, (m) => m.importe));
  let barras = [];
  if (tipo === "año") {
    const y = inicio.slice(0, 4);
    for (let i = 1; i <= 12; i++) {
      const m = `${y}-${String(i).padStart(2, "0")}`;
      barras.push({ clave: m, valor: r2(sum(variables.filter((x) => x.fecha.startsWith(m)), (x) => x.importe)), futuro: m > hoy.slice(0, 7) });
    }
  } else {
    const n = diasEntre(inicio, fin) + 1;
    for (let i = 0; i < n; i++) {
      const f = sumarDias(inicio, i);
      barras.push({ clave: f, valor: r2(sum(variables.filter((x) => x.fecha === f), (x) => x.importe)), futuro: f > hoy });
    }
  }
  const transcurridas = barras.filter((b) => !b.futuro).length || barras.length;
  const media = futuro ? 0 : r2(totalVariable / transcurridas);
  // Lo que permite el presupuesto de gasto variable por día (o por mes en la vista anual)
  const mediaPrevista = r2(tipo === "año" ? pres.variable : (pres.variable * 12) / 365);

  // Categorías
  const porId = new Map(db.partidas.map((p) => [p.id, p]));
  const cats = new Map();
  for (const m of movs) {
    const p = porId.get(m.partidaId);
    const c = p ? p.categoria : "Sin partida";
    const x = cats.get(c) || { categoria: c, total: 0, n: 0, icono: p?.icono };
    x.total += m.importe;
    x.n++;
    cats.set(c, x);
  }
  const categorias = [...cats.values()]
    .map((c) => ({ ...c, total: r2(c.total), pct: total > 0 ? (c.total / total) * 100 : 0 }))
    .filter((c) => Math.abs(c.total) >= 0.005)
    .sort((a, b) => b.total - a.total);

  return {
    inicio, fin, total, totalAnt, enCurso, futuro, presupuesto, barras, media, mediaPrevista, totalVariable, categorias, movs,
    variacion: totalAnt > 0 ? ((total - totalAnt) / totalAnt) * 100 : null,
    usoPct: presupuesto > 0 ? (total / presupuesto) * 100 : 0,
  };
}

// ---------- Simulador ----------
export function resultadoSimulacion(s) {
  const activas = s.partidas.filter((p) => p.activa);
  const fijos = r2(sum(activas.filter(esMensual), (p) => p.importe));
  const periodicos = r2(sum(activas.filter((p) => !esMensual(p)), (p) => (p.cobraEsteMes ? p.importe : prorrateo(p))));
  const puntuales = r2(sum(s.extras, (e) => e.importe));
  const ingresos = r2((Number(s.sueldo) || 0) + (Number(s.ingresosExtra) || 0));
  const gastos = r2(fijos + periodicos + puntuales);
  const resultado = r2(ingresos - gastos);
  const porCategoria = new Map();
  for (const p of activas) porCategoria.set(p.categoria, (porCategoria.get(p.categoria) || 0) + (esMensual(p) ? p.importe : p.cobraEsteMes ? p.importe : prorrateo(p)));
  if (puntuales) porCategoria.set("Gastos puntuales", puntuales);
  return {
    ingresos, fijos, periodicos, puntuales, gastos, resultado,
    ahorroPct: ingresos > 0 ? (resultado / ingresos) * 100 : 0,
    usoPct: ingresos > 0 ? (gastos / ingresos) * 100 : gastos > 0 ? 100 : 0,
    porCategoria: [...porCategoria.entries()].map(([categoria, total]) => ({ categoria, total: r2(total) })).sort((a, b) => b.total - a.total),
  };
}

export { iso };

// ---------- Ahorros ----------
const ultimoDia = (mes) => `${mes}-${String(diasEnMes(mes)).padStart(2, "0")}`;

// Primer mes con datos (sueldo o movimientos)
export function primerMes(db, hoy = hoyISO()) {
  const meses = [...Object.keys(db.meses), ...db.movimientos.filter((m) => !esAjuste(m)).map((m) => m.fecha.slice(0, 7))].filter((m) => m <= hoy.slice(0, 7)).sort();
  return meses[0] || hoy.slice(0, 7);
}

// ---------- Cuenta principal ----------
// El arrastre empieza en el primer mes con sueldo: los meses anteriores (los de
// la versión antigua no tienen sueldo) solo restarían y no reflejan la cuenta.
export function primerMesCuenta(db, hoy = hoyISO()) {
  const conSueldo = Object.keys(db.meses).filter((m) => db.meses[m]?.sueldo != null).sort();
  return conSueldo[0] || hoy.slice(0, 7);
}

// Lo que sobra (o falta) de un mes: sueldo + ingresos − gastos − ahorro neto
function disponibleMes(db, mes) {
  let total = db.meses[mes]?.sueldo ?? 0;
  for (const m of db.movimientos) {
    if (esAjuste(m) || !m.fecha.startsWith(mes)) continue;
    total += m.tipo === "ingreso" ? m.importe : -m.importe;
  }
  return total;
}

// Saldo de la cuenta principal al cerrar un mes: lo que sobró de cada mes desde
// el primero con sueldo (también en negativo) + los ajustes hasta ese mes.
export function saldoCuentaAl(db, mes, hoy = hoyISO()) {
  let saldo = sum(db.movimientos.filter((m) => m.tipo === "ajuste" && m.objetivoId === CUENTA_PRINCIPAL.id && m.fecha.slice(0, 7) <= mes), (m) => m.importe);
  for (let m = primerMesCuenta(db, hoy); m <= mes; m = moverMes(m, 1)) saldo += disponibleMes(db, m);
  return r2(saldo);
}

// Si el mes pasado te sobró dinero, propone apartarlo: como mucho lo que sobró
// ese mes, sin pasar de lo que había en la cuenta al cerrarlo.
export function propuestaCierre(db, hoy = hoyISO()) {
  const mes = moverMes(hoy.slice(0, 7), -1);
  const r = resumenMes(db, mes, hoy);
  const importe = r2(Math.min(r.disponible, r.saldoCuenta));
  if (r.sueldo == null || importe < 1) return null;
  return { mes, importe, fecha: ultimoDia(mes) };
}

// ---------- Recibos no mensuales: calendario ----------
const PASO = { Bimestral: 2, Trimestral: 3, Semestral: 6, Anual: 12 };
const mesesEntre = (a, b) => {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
};
// ¿Se cobra este recibo en ese mes? Desde el mes del próximo cobro, cada tantos meses
export function cobraEnMes(p, mes) {
  if (esMensual(p) || !p.cobroAncla) return false;
  const n = mesesEntre(p.cobroAncla, mes);
  return n >= 0 && n % PASO[p.frecuencia] === 0;
}
// Los próximos cobros de una partida a partir de un mes
export function proximosCobros(p, desde, n = 4) {
  const out = [];
  if (esMensual(p) || !p.cobroAncla) return out;
  let m = p.cobroAncla;
  while (m < desde) m = moverMes(m, PASO[p.frecuencia]);
  for (let i = 0; i < n; i++, m = moverMes(m, PASO[p.frecuencia])) out.push(m);
  return out;
}
// Cobros de los recibos no mensuales en los próximos n meses (contando el actual)
export function calendarioCobros(db, desde, n = 12) {
  const out = [];
  const conFecha = ordenar(db.partidas.filter((p) => p.activa && !esMensual(p) && p.importe > 0 && p.cobroAncla));
  for (let k = 0; k < n; k++) {
    const mes = moverMes(desde, k);
    for (const p of conFecha) if (cobraEnMes(p, mes)) out.push({ mes, k, partida: p, importe: p.importe });
  }
  return out;
}

// Cuánto apartar este mes a «Recibos no mensuales» para llegar a todos los
// cobros de los próximos 12 meses. Se supone que se aparta a principio de mes,
// antes de los recibos.
//  - sugerida: el máximo, entre los meses k (0 = este), de
//    (cobros hasta k − saldo a principio de mes) / (k + 1), nunca menos de 0,
//    más el prorrateo de los recibos sin fecha.
//  - estado: saldo − saldo necesario (el mínimo que bastaría aportando solo el
//    prorrateo normal cada mes). Positivo: vas adelantado; negativo: por detrás.
//    Apartar este mes hasta el prorrateo no lo cambia (es lo que tocaba); lo
//    que pase de ahí, sí.
//  - proximo: el próximo cobro y si la hucha llegará (aportando el prorrateo).
export function aportacionHucha(db, mes = hoyISO().slice(0, 7)) {
  // Saldo "de partida" del mes: lo de antes + los ajustes y las retiradas a mano de
  // este mes (cambian lo que hay). No incluye lo apartado este mes ni las
  // retiradas por pagar recibos (esos recibos ya están en los cobros del mes).
  const delMes = db.movimientos.filter((m) => m.fecha.startsWith(mes) && ((m.tipo === "ahorro" && m.objetivoId === OBJETIVO_FIJO.id) || (esAjuste(m) && cuentaDeAjuste(m) === OBJETIVO_FIJO.id)));
  const saldoInicio = r2(
    ahorradoObjetivo(db, OBJETIVO_FIJO.id, `${mes}-01`) + sum(delMes.filter((m) => esAjuste(m) || (m.importe < 0 && !m.enlace)), (m) => m.importe)
  );
  const aportes = delMes.filter((m) => m.tipo === "ahorro" && m.importe > 0 && !m.enlace);
  const apartadoMes = r2(sum(aportes, (m) => m.importe));
  const saldo = ahorradoObjetivo(db, OBJETIVO_FIJO.id);

  const noMensuales = db.partidas.filter((p) => p.activa && !esMensual(p) && p.importe > 0);
  const sinFecha = r2(sum(noMensuales.filter((p) => !p.cobroAncla), prorrateo));
  const prorrateoConFecha = sum(noMensuales.filter((p) => p.cobroAncla), prorrateo);
  const prorrateoTotal = r2(prorrateoConFecha + sinFecha);

  const cobros = calendarioCobros(db, mes, 12);
  const acumulado = [];
  for (let k = 0, c = 0; k < 12; k++) {
    c += sum(cobros.filter((x) => x.k === k), (x) => x.importe);
    acumulado.push(c);
  }
  const sugerida = r2(Math.max(0, ...acumulado.map((c, k) => (c - saldoInicio) / (k + 1))) + sinFecha);
  const necesario = Math.max(0, ...acumulado.map((c, k) => c - prorrateoConFecha * (k + 1)));
  const estado = r2(saldoInicio - necesario + Math.max(0, apartadoMes - prorrateoTotal));

  // El próximo cobro que aún no se ha pagado (los de este mes ya cargados se saltan)
  const pagadoEsteMes = gastosPorPartida(movsDeMes(db, mes), db.partidas);
  const x = cobros.find((c) => c.k > 0 || !(pagadoEsteMes.get(c.partida.id) > 0));
  let proximo = null;
  if (x) {
    // Lo que habrá ese mes: el saldo de principio de mes + lo de este mes (lo
    // apartado, o el prorrateo si aún no) + el prorrateo de los meses siguientes
    const tendra = saldoInicio + Math.max(apartadoMes, prorrateoConFecha) + prorrateoConFecha * x.k;
    proximo = { partida: x.partida, mes: x.mes, importe: x.importe, meses: x.k, cubierto: tendra + 0.005 >= acumulado[x.k] };
  }
  return { saldo, saldoInicio, apartadoMes, sugerida, estado, proximo, cobros, prorrateo: prorrateoTotal, sinFecha };
}

// Lo apartado cada mes (últimos n meses hasta "hasta") y qué parte del sueldo supone
export function evolucionAhorro(db, hasta, n = 12) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const mes = moverMes(hasta, -i);
    const movs = movsDeMes(db, mes);
    // Las retiradas para pagar recibos (enlazadas) no son "dejar de ahorrar"
    const ahorrado = r2(sum(movs.filter((m) => m.tipo === "ahorro" && !m.enlace), (m) => m.importe));
    const entradas = r2((db.meses[mes]?.sueldo ?? 0) + sum(movs.filter((m) => m.tipo === "ingreso"), (m) => m.importe));
    out.push({ mes, ahorrado, entradas, pct: entradas > 0 ? (ahorrado / entradas) * 100 : null });
  }
  return out;
}

// "Recibos no mensuales": saldo y cuánto apartar (ver aportacionHucha)
export function huchaPeriodicos(db, mes) {
  const h = aportacionHucha(db, mes);
  return { ...h, alMes: h.prorrateo };
}

export const ahorrosPrincipales = (db) => ahorradoObjetivo(db, AHORRO_PRINCIPAL.id);

// Lo que hay entre todas las cuentas de ahorro
export function resumenCuentas(db) {
  const principales = ahorrosPrincipales(db);
  const noMensuales = huchaPeriodicos(db).saldo;
  const objetivos = r2(sum(db.objetivos, (o) => ahorradoObjetivo(db, o.id)));
  return { principales, noMensuales, objetivos, total: r2(principales + noMensuales + objetivos) };
}
