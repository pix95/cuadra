// Cálculos del presupuesto. Todo es puro: recibe los datos y devuelve cifras.
import { r2, sum, diasEnMes, fechaDe, iso, sumarDias, moverMes, hoyISO } from "./formato.js";

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

export const movsDeMes = (db, mes) => db.movimientos.filter((m) => m.fecha.startsWith(mes));

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

  // Lo que todavía falta por salir según el presupuesto (nunca negativo por partida)
  let pendiente = 0;
  for (const p of db.partidas) {
    if (!p.activa) continue;
    pendiente += Math.max(0, previstoMes(p) - (gp.get(p.id) || 0));
  }
  pendiente = r2(pendiente);
  const prevision = r2(disponible - pendiente);

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
  let saldo = sueldo ?? 0;
  for (let d = 1; d <= Math.max(1, dia); d++) {
    saldo += porDia[d];
    serie.push(r2(saldo));
  }

  return {
    mes, sueldo, gastado, ingresos, ahorrado, entradas, disponible, pendiente, prevision,
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

// Gastos de cada partida periódica en lo que va de año (hasta el mes indicado)
export function acumuladoAño(db, mes) {
  const año = mes.slice(0, 4);
  const movs = db.movimientos.filter((m) => m.tipo === "gasto" && m.fecha.startsWith(año) && m.fecha.slice(0, 7) <= mes);
  return gastosPorPartida(movs, db.partidas);
}

export function ahorradoObjetivo(db, id) {
  return r2(sum(db.movimientos.filter((m) => m.tipo === "ahorro" && m.objetivoId === id), (m) => m.importe));
}

// Partidas más usadas en los últimos 90 días (para los accesos rápidos)
export function partidasFrecuentes(db, n = 8) {
  const limite = sumarDias(hoyISO(), -90);
  const cuenta = new Map();
  db.movimientos.forEach((m) => {
    if (m.tipo === "gasto" && m.fecha >= limite) cuenta.set(m.partidaId, (cuenta.get(m.partidaId) || 0) + 1);
  });
  const activas = db.partidas.filter((p) => p.activa);
  let ids = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => activas.some((p) => p.id === id));
  // Si aún hay pocos datos, se completan con las partidas variables (las que más se apuntan)
  for (const p of ordenar(activas.filter((p) => !p.recibo && esMensual(p)))) if (!ids.includes(p.id)) ids.push(p.id);
  for (const p of ordenar(activas)) if (!ids.includes(p.id)) ids.push(p.id);
  return ids.slice(0, n).map((id) => activas.find((p) => p.id === id));
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

  // Barras
  let barras = [];
  if (tipo === "año") {
    const y = inicio.slice(0, 4);
    for (let i = 1; i <= 12; i++) {
      const m = `${y}-${String(i).padStart(2, "0")}`;
      barras.push({ clave: m, valor: r2(sum(movs.filter((x) => x.fecha.startsWith(m)), (x) => x.importe)), futuro: m > hoy.slice(0, 7) });
    }
  } else {
    const n = diasEntre(inicio, fin) + 1;
    for (let i = 0; i < n; i++) {
      const f = sumarDias(inicio, i);
      barras.push({ clave: f, valor: r2(sum(movs.filter((x) => x.fecha === f), (x) => x.importe)), futuro: f > hoy });
    }
  }
  const transcurridas = barras.filter((b) => !b.futuro).length || barras.length;
  const media = futuro ? 0 : r2(total / transcurridas);

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
    inicio, fin, total, totalAnt, enCurso, futuro, presupuesto, barras, media, categorias, movs,
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
