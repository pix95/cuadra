// Reglas de los datos de Cuadra: validación y operaciones.
// Lo usan el servidor Node (server/) y la app cuando guarda en Supabase,
// así las dos se comportan igual.
//
// Cada operación recibe el estado completo, lo modifica y devuelve
// { r: resultado, cambios: [...] }. "cambios" son las filas tocadas, para
// poder enviarlas a la nube.

export const FRECUENCIAS = ["Mensual", "Bimestral", "Trimestral", "Semestral", "Anual", "Meses concretos"];
// «Meses concretos»: la partida cobra en los meses que elijas, cada uno con su
// importe (por ejemplo, un curso con matrícula al empezar y cuotas trimestrales).
// Su importe es el total del año.
export const MESES_CONCRETOS = "Meses concretos";
export function normalizarCalendario(c) {
  const out = new Map();
  for (const x of Array.isArray(c) ? c : []) {
    const mes = Math.round(Number(x?.mes));
    const importe = r2(Number(x?.importe));
    if (mes >= 1 && mes <= 12 && Number.isFinite(importe) && importe > 0) out.set(mes, importe);
  }
  return [...out].sort((a, b) => a[0] - b[0]).map(([mes, importe]) => ({ mes, importe }));
}
export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const uid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      });

// Objetivo fijo "Recibos no mensuales": existe siempre y no se guarda como objetivo
export const OBJETIVO_FIJO = {
  id: "00000000-0000-4000-8000-0000000000fa",
  nombre: "Recibos no mensuales",
  meta: 0,
  fecha: null,
  icono: "calendario",
  fijo: true,
};
// Cuenta de ahorro principal: lo que apartas sin un objetivo concreto
export const AHORRO_PRINCIPAL = {
  id: "00000000-0000-4000-8000-0000000000ab",
  nombre: "Ahorros principales",
  meta: 0,
  fecha: null,
  icono: "hucha",
  fijo: true,
};
export const objetivosConFijo = (d) => [AHORRO_PRINCIPAL, OBJETIVO_FIJO, ...(d.objetivos || [])];
// La cuenta del banco donde entra el sueldo. Solo se usa en los ajustes
// («Cuadrar con el banco»); lo que sobra cada mes se queda en ella.
export const CUENTA_PRINCIPAL = {
  id: "00000000-0000-4000-8000-0000000000cc",
  nombre: "Cuenta principal",
  meta: 0,
  fecha: null,
  icono: "cartera",
  fijo: true,
};
// Todas las cuentas a las que se les puede hacer un ajuste
export const cuentas = (d) => [CUENTA_PRINCIPAL, ...objetivosConFijo(d)];
// A qué cuenta pertenece un ajuste ("inicial" es el ajuste antiguo de Ahorros principales)
export const cuentaDeAjuste = (m) => (m.tipo === "inicial" ? AHORRO_PRINCIPAL.id : m.tipo === "ajuste" ? m.objetivoId : null);
export const TIPOS_MOVIMIENTO = ["gasto", "ingreso", "ahorro", "ajuste", "inicial"];

export class ErrorDatos extends Error {
  constructor(msg, status = 400) {
    super(msg);
    this.status = status;
    this.expose = true;
  }
}
const falla = (msg, status) => {
  throw new ErrorDatos(msg, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esFecha = (v) => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v) && !Number.isNaN(Date.parse(v));
export const esMes = (v) => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export function mesSiguiente(ym) {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
const ahora = () => new Date().toISOString();

function texto(v, campo, { max = 80, obligatorio = false } = {}) {
  const s = v == null ? "" : String(v).trim();
  if (obligatorio && !s) falla(`Falta ${campo}.`);
  if (s.length > max) falla(`${campo} es demasiado largo (máximo ${max} caracteres).`);
  return s;
}

function numero(v, campo, { min = -1e8, max = 1e8, ceroVale = true } = {}) {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  if (v === "" || v == null || !Number.isFinite(n)) falla(`${campo} debe ser un número.`);
  if (!ceroVale && r2(n) === 0) falla(`${campo} no puede ser cero.`);
  if (n < min || n > max) falla(`${campo} está fuera de rango.`);
  return r2(n);
}

function idNuevo(v, lista) {
  if (v == null || v === "") return uid();
  if (!UUID.test(String(v))) falla("Identificador no válido.");
  if (lista.some((x) => x.id === v)) falla("Ya existe un registro con ese identificador.", 409);
  return String(v);
}

const buscar = (lista, id, que) => lista.find((x) => x.id === id) || falla(`No existe ${que}.`, 404);
const siguienteOrden = (d) => (d.partidas.length ? Math.max(...d.partidas.map((p) => p.orden)) + 1 : 0);

// ---------- Forma de los datos ----------
export function normalizarPartida(p, i = 0) {
  return {
    id: p.id || uid(),
    nombre: String(p.nombre ?? "").trim().slice(0, 60),
    categoria: (String(p.categoria ?? "").trim() || "Otros").slice(0, 40),
    importe:
      p.frecuencia === MESES_CONCRETOS ? r2(normalizarCalendario(p.calendario).reduce((s, x) => s + x.importe, 0)) : r2(Math.max(0, Number(p.importe) || 0)),
    frecuencia: FRECUENCIAS.includes(p.frecuencia) ? p.frecuencia : "Mensual",
    calendario: p.frecuencia === MESES_CONCRETOS ? normalizarCalendario(p.calendario) : null,
    recibo: Boolean(p.recibo),
    icono: typeof p.icono === "string" && p.icono ? p.icono.slice(0, 30) : "paquete",
    orden: Number.isFinite(Number(p.orden)) ? Number(p.orden) : i,
    activa: p.activa !== false,
    // Mes del próximo cobro de un recibo no mensual ("AAAA-MM"); sin él, es un fondo sin fecha
    cobroAncla: (p.frecuencia ?? "Mensual") !== "Mensual" && p.frecuencia !== MESES_CONCRETOS && esMes(p.cobroAncla) ? p.cobroAncla : null,
    // Partida «del coche» (seguro, impuesto…): de qué vehículo y qué parte es suya
    vehiculoId: UUID.test(String(p.vehiculoId ?? "")) ? String(p.vehiculoId) : null,
    pctCoche: UUID.test(String(p.vehiculoId ?? "")) ? Math.min(100, Math.max(1, Math.round(Number(p.pctCoche) || 100))) : null,
  };
}

// Configuración de la nómina: importe habitual, día a partir del cual cuenta
// para el mes siguiente y pagas extra (en qué nóminas van y cuánto suman).
export const DIA_CORTE_NOMINA = 20;
export function normalizarNomina(n) {
  if (!n || typeof n !== "object") return null;
  const importe = Number(n.importe);
  const dia = Math.round(Number(n.diaCorte));
  const extra = n.pagasExtra && typeof n.pagasExtra === "object" ? n.pagasExtra : {};
  const meses = [...new Set((Array.isArray(extra.meses) ? extra.meses : []).map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
  return {
    importe: n.importe == null || n.importe === "" || !Number.isFinite(importe) ? null : r2(Math.max(0, importe)),
    diaCorte: Number.isFinite(dia) && dia >= 1 && dia <= 31 ? dia : DIA_CORTE_NOMINA,
    pagasExtra: { meses, importe: r2(Math.max(0, Number(extra.importe) || 0)) },
  };
}

export const estadoVacio = () => ({
  version: 2,
  ajustes: { nombre: "", sueldoSugerido: null, nomina: null },
  partidas: [],
  meses: {},
  movimientos: [],
  objetivos: [],
  simulaciones: [],
  vehiculos: [],
  repostajes: [],
  mantenimientos: [],
  recordatorios: [],
});

export function semilla(inicial) {
  const d = estadoVacio();
  d.ajustes.sueldoSugerido = inicial?.sueldoSugerido ?? null;
  d.partidas = (inicial?.partidas || []).map((p, i) => normalizarPartida({ ...p, id: uid(), orden: i, activa: true }, i));
  return d;
}

// Completa campos que falten si los datos son de una versión anterior
export function migrar(d) {
  d.version = 2;
  d.ajustes = { nombre: "", sueldoSugerido: null, ...(d.ajustes || {}) };
  d.ajustes.nomina = normalizarNomina(d.ajustes.nomina);
  d.partidas = (d.partidas || []).map((p, i) => normalizarPartida(p, i));
  d.meses = d.meses && typeof d.meses === "object" ? d.meses : {};
  d.movimientos = Array.isArray(d.movimientos) ? d.movimientos : [];
  d.objetivos = Array.isArray(d.objetivos) ? d.objetivos : [];
  d.simulaciones = Array.isArray(d.simulaciones) ? d.simulaciones : [];
  for (const t of TABLAS_COCHE) d[t] = Array.isArray(d[t]) ? d[t] : [];
  return d;
}

// ---------- Validación ----------
function validarPartida(b, base = {}) {
  const p = { ...base };
  if ("nombre" in b || !base.id) p.nombre = texto(b.nombre, "El nombre", { max: 60, obligatorio: true });
  if ("categoria" in b) p.categoria = texto(b.categoria, "La categoría", { max: 40 }) || "Otros";
  if ("importe" in b || !base.id) p.importe = numero(b.importe ?? 0, "El importe", { min: 0 });
  if ("frecuencia" in b) {
    if (!FRECUENCIAS.includes(b.frecuencia)) falla("Frecuencia no válida.");
    p.frecuencia = b.frecuencia;
  }
  if ("recibo" in b) p.recibo = Boolean(b.recibo);
  if ("icono" in b) p.icono = texto(b.icono, "El icono", { max: 30 }) || "paquete";
  if ("activa" in b) p.activa = Boolean(b.activa);
  if ("orden" in b) p.orden = numero(b.orden, "El orden");
  if ("cobroAncla" in b) {
    if (b.cobroAncla && !esMes(b.cobroAncla)) falla("El mes del próximo cobro no es válido.");
    p.cobroAncla = b.cobroAncla || null;
  }
  if ("calendario" in b) {
    if (b.calendario != null && !Array.isArray(b.calendario)) falla("Los meses de cobro no son válidos.");
    for (const x of b.calendario || []) {
      const mes = Number(x?.mes);
      if (!Number.isInteger(mes) || mes < 1 || mes > 12) falla("Un mes de cobro no es válido.");
      numero(x?.importe, "El importe de cada mes", { min: 0.01, max: 1e7 });
    }
    p.calendario = b.calendario || null;
  }
  if ((p.frecuencia ?? base.frecuencia) === MESES_CONCRETOS && !normalizarCalendario(p.calendario ?? base.calendario).length)
    falla("Elige al menos un mes de cobro con su importe.");
  if ("vehiculoId" in b) {
    if (b.vehiculoId && !UUID.test(String(b.vehiculoId))) falla("El vehículo no es válido.");
    p.vehiculoId = b.vehiculoId || null;
  }
  if ("pctCoche" in b && b.pctCoche != null && b.pctCoche !== "") {
    const n = numero(b.pctCoche, "El porcentaje del coche", { min: 1, max: 100 });
    p.pctCoche = Math.round(n);
  }
  return p;
}

function validarMovimiento(b, d, base = {}) {
  const m = { ...base };
  const tipo = b.tipo ?? base.tipo ?? "gasto";
  if (!TIPOS_MOVIMIENTO.includes(tipo)) falla("Tipo de movimiento no válido.");
  m.tipo = tipo;
  if ("fecha" in b || !base.id) {
    if (!esFecha(b.fecha)) falla("La fecha no es válida.");
    m.fecha = b.fecha;
  }
  if ("importe" in b || !base.id) m.importe = numero(b.importe, "El importe", { ceroVale: false, min: -1e7, max: 1e7 });
  if ("concepto" in b) m.concepto = texto(b.concepto, "El concepto", { max: 80 });
  m.concepto ??= "";

  const partidaId = "partidaId" in b ? b.partidaId : base.partidaId;
  const objetivoId = "objetivoId" in b ? b.objetivoId : base.objetivoId;
  m.partidaId = null;
  m.objetivoId = null;
  if (tipo === "gasto") {
    if (!partidaId) falla("Elige una partida.");
    if (!d.partidas.some((p) => p.id === partidaId)) falla("La partida no existe.");
    m.partidaId = partidaId;
  } else if (tipo === "ahorro") {
    if (!objetivoId) falla("Elige un objetivo de ahorro.");
    // Se permite conservar el de un objetivo ya eliminado al editar
    if (!objetivosConFijo(d).some((o) => o.id === objetivoId) && objetivoId !== base.objetivoId) falla("El objetivo no existe.");
    m.objetivoId = objetivoId;
  } else if (tipo === "ajuste") {
    if (!objetivoId) falla("Elige la cuenta que quieres cuadrar.");
    if (!cuentas(d).some((o) => o.id === objetivoId) && objetivoId !== base.objetivoId) falla("La cuenta no existe.");
    m.objetivoId = objetivoId;
  }
  // Mes al que cuenta (el gasto del 30 de noviembre, con la nómina de diciembre
  // ya ingresada, cuenta para diciembre). Solo se guarda si no es el de la fecha,
  // y solo puede ser ese o el siguiente.
  const mesB = "mes" in b ? b.mes : base.mes;
  m.mes = null;
  if (mesB && tipo !== "ajuste" && tipo !== "inicial") {
    if (!esMes(mesB)) falla("El mes del movimiento no es válido.");
    const mesFecha = m.fecha.slice(0, 7);
    if (mesB !== mesFecha) {
      if (mesB !== mesSiguiente(mesFecha)) falla("Un movimiento solo puede contar para el mes de su fecha o para el siguiente.");
      m.mes = mesB;
    }
  }
  // Movimiento enlazado (gasto pagado desde la hucha ↔ su retirada)
  const enlace = "enlace" in b ? b.enlace : base.enlace;
  m.enlace = enlace && UUID.test(String(enlace)) ? String(enlace) : null;
  return m;
}

// Saldo de la hucha «Recibos no mensuales» sin contar unos movimientos concretos
function saldoHucha(d, sin = []) {
  return r2(
    d.movimientos
      .filter((m) => !sin.includes(m.id) && ((m.tipo === "ahorro" && m.objetivoId === OBJETIVO_FIJO.id) || (m.tipo === "ajuste" && m.objetivoId === OBJETIVO_FIJO.id)))
      .reduce((s, m) => s + m.importe, 0)
  );
}

function validarObjetivo(b, base = {}) {
  const o = { ...base };
  if ("nombre" in b || !base.id) o.nombre = texto(b.nombre, "El nombre", { max: 50, obligatorio: true });
  if ("meta" in b || !base.id) o.meta = numero(b.meta ?? 0, "La meta", { min: 0 });
  if ("fecha" in b) {
    if (b.fecha && !esMes(b.fecha)) falla("La fecha objetivo no es válida.");
    o.fecha = b.fecha || null;
  }
  o.fecha ??= null;
  if ("icono" in b) o.icono = texto(b.icono, "El icono", { max: 30 }) || "hucha";
  o.icono ??= "hucha";
  return o;
}

function validarSimulacion(b, base = {}) {
  const s = { ...base };
  if ("nombre" in b || !base.id) s.nombre = texto(b.nombre, "El nombre", { max: 60 }) || "Escenario";
  if ("sueldo" in b || !base.id) s.sueldo = numero(b.sueldo ?? 0, "El sueldo", { min: 0 });
  if ("ingresosExtra" in b || !base.id) s.ingresosExtra = numero(b.ingresosExtra ?? 0, "Los ingresos extra", { min: 0 });
  if ("partidas" in b || !base.id) {
    const ps = Array.isArray(b.partidas) ? b.partidas : [];
    if (ps.length > 300) falla("Demasiadas partidas.");
    s.partidas = ps.map((p, i) => ({
      ...normalizarPartida({ ...p, nombre: texto(p.nombre, "El nombre de una partida", { max: 60 }) || "Sin nombre" }, i),
      id: UUID.test(String(p.id)) ? String(p.id) : uid(),
      origenId: UUID.test(String(p.origenId)) ? String(p.origenId) : null,
      cobraEsteMes: Boolean(p.cobraEsteMes),
    }));
  }
  if ("extras" in b || !base.id) {
    const es = Array.isArray(b.extras) ? b.extras : [];
    if (es.length > 200) falla("Demasiados gastos puntuales.");
    s.extras = es.map((e) => ({
      id: UUID.test(String(e.id)) ? String(e.id) : uid(),
      concepto: texto(e.concepto, "El concepto", { max: 60 }) || "Gasto puntual",
      importe: numero(e.importe ?? 0, "El importe de un gasto puntual", { min: 0 }),
    }));
  }
  if ("nota" in b) s.nota = texto(b.nota, "La nota", { max: 300 });
  s.nota ??= "";
  return s;
}

// ---------- Coche ----------
export const TABLAS_COCHE = ["vehiculos", "repostajes", "mantenimientos", "recordatorios"];
export const COMBUSTIBLES = { gasolina: "Gasolina", diesel: "Diésel", hibrido: "Híbrido", electrico: "Eléctrico" };
export const TIPOS_MANTENIMIENTO = { revision: "Revisión", itv: "ITV", aceite: "Aceite", neumaticos: "Neumáticos", reparacion: "Reparación", otro: "Otro" };
export const TIPOS_RECORDATORIO = { itv: "ITV", revision: "Revisión", seguro: "Seguro", impuesto: "Impuesto de circulación", aceite: "Aceite", otro: "Otro" };
const fechaTxt = (f) => f.split("-").reverse().join("/");
const kmTxt = (n) => `${Math.round(n).toLocaleString("es-ES")} km`;
const kmValidos = (v, campo) => Math.round(numero(v, campo, { min: 0, max: 9999999 }));

function validarVehiculo(b, d, base = {}) {
  const v = { ...base };
  if ("nombre" in b || !base.id) v.nombre = texto(b.nombre, "El nombre", { max: 40 }) || "Mi coche";
  if ("combustible" in b || !base.id) {
    const c = b.combustible ?? "gasolina";
    if (!(c in COMBUSTIBLES)) falla("Combustible no válido.");
    v.combustible = c;
  }
  if ("kmIniciales" in b || !base.id) v.kmIniciales = kmValidos(b.kmIniciales ?? 0, "Los km");
  for (const k of ["partidaCombustible", "partidaMantenimiento"]) {
    if (k in b || !base.id) {
      const id = b[k] || null;
      if (id && !d.partidas.some((p) => p.id === id)) falla("La partida elegida no existe.");
      v[k] = id;
    }
  }
  if ("activo" in b || !base.id) v.activo = b.activo !== false;
  return v;
}

function validarRepostaje(b, d, base = {}) {
  const r = { ...base, ...b };
  if (!d.vehiculos.some((v) => v.id === r.vehiculoId)) falla("Elige el vehículo del repostaje.");
  if (!esFecha(r.fecha)) falla("La fecha del repostaje no es válida.");
  return {
    id: r.id,
    vehiculoId: r.vehiculoId,
    fecha: r.fecha,
    km: kmValidos(r.km, "Los km del cuentakilómetros"),
    litros: numero(r.litros, "Los litros", { min: 0.01, max: 2000 }),
    importe: numero(r.importe, "El importe", { min: -1e7, max: 1e7 }),
    lleno: r.lleno !== false,
    gasolinera: texto(r.gasolinera, "La gasolinera", { max: 60 }),
    movimientoId: UUID.test(String(r.movimientoId ?? "")) ? String(r.movimientoId) : null,
  };
}

// Los km no pueden ir hacia atrás: ni menos que el repostaje anterior ni más
// que el siguiente del mismo vehículo.
function comprobarKm(d, r) {
  for (const o of d.repostajes) {
    if (o.id === r.id || o.vehiculoId !== r.vehiculoId) continue;
    if (o.fecha < r.fecha && o.km > r.km)
      falla(`Los km (${kmTxt(r.km)}) no pueden ser menos que los del repostaje anterior, del ${fechaTxt(o.fecha)} (${kmTxt(o.km)}). Revisa el cuentakilómetros o la fecha.`);
    if (o.fecha > r.fecha && o.km < r.km)
      falla(`Los km (${kmTxt(r.km)}) no pueden ser más que los del repostaje siguiente, del ${fechaTxt(o.fecha)} (${kmTxt(o.km)}). Revisa el cuentakilómetros o la fecha.`);
  }
}

function validarMantenimiento(b, d, base = {}) {
  const m = { ...base, ...b };
  if (!d.vehiculos.some((v) => v.id === m.vehiculoId)) falla("Elige el vehículo del mantenimiento.");
  if (!esFecha(m.fecha)) falla("La fecha del mantenimiento no es válida.");
  const tipo = m.tipo || "otro";
  if (!(tipo in TIPOS_MANTENIMIENTO)) falla("Tipo de mantenimiento no válido.");
  return {
    id: m.id,
    vehiculoId: m.vehiculoId,
    fecha: m.fecha,
    km: m.km == null || m.km === "" ? null : kmValidos(m.km, "Los km"),
    tipo,
    importe: numero(m.importe, "El importe", { min: -1e7, max: 1e7 }),
    taller: texto(m.taller, "El taller", { max: 60 }),
    notas: texto(m.notas, "Las notas", { max: 300 }),
    movimientoId: UUID.test(String(m.movimientoId ?? "")) ? String(m.movimientoId) : null,
  };
}

function validarRecordatorio(b, d, base = {}) {
  const r = { ...base, ...b };
  if (!d.vehiculos.some((v) => v.id === r.vehiculoId)) falla("Elige el vehículo del recordatorio.");
  const tipo = r.tipo || "otro";
  if (!(tipo in TIPOS_RECORDATORIO)) falla("Tipo de recordatorio no válido.");
  const vacio = (x) => x == null || x === "";
  if (!vacio(r.proximaFecha) && !esFecha(r.proximaFecha)) falla("La fecha del recordatorio no es válida.");
  const out = {
    id: r.id,
    vehiculoId: r.vehiculoId,
    tipo,
    nota: texto(r.nota, "La nota", { max: 60 }),
    proximaFecha: vacio(r.proximaFecha) ? null : r.proximaFecha,
    proximosKm: vacio(r.proximosKm) ? null : kmValidos(r.proximosKm, "Los km"),
    repetirMeses: vacio(r.repetirMeses) ? null : Math.round(numero(r.repetirMeses, "Cada cuántos meses", { min: 1, max: 240 })),
    repetirKm: vacio(r.repetirKm) ? null : kmValidos(r.repetirKm, "Cada cuántos km"),
  };
  if (out.proximaFecha == null && out.proximosKm == null) falla("Pon una fecha, unos km o las dos cosas.");
  return out;
}

// Copias marcadas con su tabla, para que «Deshacer» sepa dónde devolverlas
const marcar = (tabla, x) => ({ ...x, _tabla: tabla });
const TABLAS_ENLAZADAS = ["repostajes", "mantenimientos"];

// ---------- Operaciones ----------
const subir = (tabla, fila) => ({ tabla, tipo: "upsert", id: tabla === "meses" ? fila.mes : tabla === "ajustes" ? "yo" : fila.id, fila: { ...fila } });
const quitar = (tabla, id) => ({ tabla, tipo: "delete", id });
const hecho = (r, ...cambios) => ({ r, cambios });

export const op = {
  guardarAjustes(d, b = {}) {
    const nuevo = { ...d.ajustes };
    if ("nombre" in b) nuevo.nombre = texto(b.nombre, "El nombre", { max: 40 });
    if ("sueldoSugerido" in b) nuevo.sueldoSugerido = b.sueldoSugerido == null ? null : numero(b.sueldoSugerido, "El sueldo", { min: 0 });
    if ("nomina" in b) {
      const n = b.nomina;
      if (n != null) {
        if (n.importe != null && n.importe !== "") numero(n.importe, "El importe de la nómina", { min: 0, max: 1e7 });
        const dia = Number(n.diaCorte);
        if (n.diaCorte != null && !(Number.isInteger(dia) && dia >= 1 && dia <= 31)) falla("El día de corte tiene que estar entre 1 y 31.");
        if (n.pagasExtra?.importe != null && n.pagasExtra.importe !== "") numero(n.pagasExtra.importe, "El importe de la paga extra", { min: 0, max: 1e7 });
      }
      nuevo.nomina = normalizarNomina(n);
    }
    d.ajustes = nuevo;
    return hecho(nuevo, subir("ajustes", nuevo));
  },

  // opciones.ingresada: fecha en que entró la nómina en la cuenta ("AAAA-MM-DD"),
  // null para quitarla; si no se pasa, se conserva la que hubiera.
  ponerSueldo(d, mes, valor, opciones) {
    if (!esMes(mes)) falla("Mes no válido.");
    const sueldo = valor == null || valor === "" ? null : numero(valor, "El sueldo", { min: 0, max: 1e7 });
    const cambios = [];
    if (sueldo == null) {
      delete d.meses[mes];
      cambios.push(quitar("meses", mes));
    } else {
      let ingresada = d.meses[mes]?.ingresada ?? null;
      if (opciones && "ingresada" in opciones) {
        if (opciones.ingresada != null && !esFecha(opciones.ingresada)) falla("La fecha de la nómina no es válida.");
        ingresada = opciones.ingresada ?? null;
      }
      d.meses[mes] = { sueldo, ingresada };
      d.ajustes = { ...d.ajustes, sueldoSugerido: sueldo };
      cambios.push(subir("meses", { mes, sueldo, ingresada }), subir("ajustes", d.ajustes));
    }
    return hecho({ meses: d.meses, ajustes: d.ajustes }, ...cambios);
  },

  crearMovimiento(d, b = {}) {
    const m = validarMovimiento(b, d);
    m.id = idNuevo(b.id, d.movimientos);
    m.creado = typeof b.creado === "string" && b.creado.length <= 30 ? b.creado : ahora();
    d.movimientos.push(m);
    return hecho(m, subir("movimientos", m));
  },
  actualizarMovimiento(d, id, b = {}) {
    const actual = buscar(d.movimientos, id, "ese movimiento");
    Object.assign(actual, validarMovimiento(b, d, actual));
    return hecho(actual, subir("movimientos", actual));
  },
  // Borra un movimiento y, si va enlazado (gasto pagado desde la hucha), también el otro.
  // Devuelve los borrados para poder deshacerlo.
  borrarMovimiento(d, id) {
    const m = buscar(d.movimientos, id, "ese movimiento");
    const otro = m.enlace && d.movimientos.find((x) => x.id === m.enlace);
    const ids = [m.id, ...(otro ? [otro.id] : [])];
    const borrados = d.movimientos.filter((x) => ids.includes(x.id)).map((x) => ({ ...x }));
    d.movimientos = d.movimientos.filter((x) => !ids.includes(x.id));
    const cambios = ids.map((i) => quitar("movimientos", i));
    // El repostaje o el mantenimiento del gasto se van con él
    for (const t of TABLAS_ENLAZADAS) {
      for (const x of d[t].filter((x) => ids.includes(x.movimientoId))) {
        borrados.push(marcar(t, x));
        cambios.push(quitar(t, x.id));
      }
      d[t] = d[t].filter((x) => !ids.includes(x.movimientoId));
    }
    return hecho({ ok: true, borrados }, ...cambios);
  },

  // Vuelve a dejar unos movimientos como estaban (para «Deshacer»): los que
  // existen se sobrescriben, los que no se crean con el mismo id, y los de
  // "quitar" se borran.
  restaurarMovimientos(d, lista, quitarIds) {
    // Pueden llegar como null desde el servidor (JSON no tiene undefined)
    lista = Array.isArray(lista) ? lista : [];
    quitarIds = Array.isArray(quitarIds) ? quitarIds : [];
    const cambios = [];
    for (const id of quitarIds) {
      for (const t of ["movimientos", ...TABLAS_ENLAZADAS]) {
        if (d[t].some((m) => m.id === id)) {
          d[t] = d[t].filter((m) => m.id !== id);
          cambios.push(quitar(t, id));
        }
      }
    }
    // Primero los movimientos y después lo del coche (en la cola, por orden)
    const coche = lista.filter((x) => TABLAS_ENLAZADAS.includes(x?._tabla));
    lista = lista.filter((x) => !TABLAS_ENLAZADAS.includes(x?._tabla));
    for (const x of lista) {
      const i = d.movimientos.findIndex((m) => m.id === x.id);
      const m = { ...validarMovimiento(x, d, i >= 0 ? d.movimientos[i] : {}), id: x.id, creado: x.creado || ahora() };
      if (i >= 0) d.movimientos[i] = m;
      else d.movimientos.push(m);
      cambios.push(subir("movimientos", m));
    }
    for (const { _tabla: t, ...x } of coche) {
      if (!UUID.test(String(x.id))) falla("Identificador no válido.");
      const val = t === "repostajes" ? validarRepostaje(x, d) : validarMantenimiento(x, d);
      const i = d[t].findIndex((y) => y.id === x.id);
      if (i >= 0) d[t][i] = val;
      else d[t].push(val);
      cambios.push(subir(t, val));
    }
    return hecho({ ok: true }, ...cambios);
  },

  // Guarda un gasto (nuevo o corregido). Si es de una partida no mensual y se
  // paga desde la hucha, crea o actualiza a la vez la retirada de «Recibos no
  // mensuales» por lo que la hucha pueda cubrir, enlazada con el gasto.
  //
  // opciones.repostaje / opciones.mantenimiento: { vehiculoId, km, litros… }
  // crea o actualiza el registro del coche enlazado al gasto; null lo quita; sin
  // pasarlo, el que hubiera sigue con la fecha y el importe del gasto.
  // Devuelve también "deshacer": cómo estaba todo y qué se ha creado.
  guardarGasto(d, b = {}, opciones) {
    const desdeHucha = Boolean(opciones?.desdeHucha);
    const existente = b.id && d.movimientos.find((m) => m.id === b.id);
    const viejos = {};
    for (const t of TABLAS_ENLAZADAS) viejos[t] = existente ? d[t].find((x) => x.movimientoId === existente.id) || null : null;
    const antes = existente
      ? [
          { ...existente },
          ...d.movimientos.filter((m) => existente.enlace && m.id === existente.enlace).map((m) => ({ ...m })),
          ...TABLAS_ENLAZADAS.filter((t) => viejos[t]).map((t) => marcar(t, viejos[t])),
        ]
      : [];
    const gasto = existente ? { ...existente, ...validarMovimiento(b, d, existente) } : { ...validarMovimiento(b, d), id: idNuevo(b.id, d.movimientos), creado: ahora() };
    if (gasto.tipo !== "gasto") falla("Solo los gastos se pueden pagar desde la hucha.");
    const partida = d.partidas.find((p) => p.id === gasto.partidaId);

    // Registros del coche: se validan antes de tocar nada
    const nuevosCoche = {};
    for (const [t, clave] of [["repostajes", "repostaje"], ["mantenimientos", "mantenimiento"]]) {
      const o = opciones?.[clave];
      const viejo = viejos[t];
      if (o === null || (o === undefined && !viejo)) {
        nuevosCoche[t] = null;
        continue;
      }
      const base = { ...(viejo || { id: uid() }), ...(o || {}), fecha: gasto.fecha, importe: gasto.importe, movimientoId: gasto.id };
      if (!base.vehiculoId) {
        const v = d.vehiculos.find((v) => v[clave === "repostaje" ? "partidaCombustible" : "partidaMantenimiento"] === gasto.partidaId) || d.vehiculos[0];
        base.vehiculoId = v?.id;
      }
      const val = t === "repostajes" ? validarRepostaje(base, d) : validarMantenimiento(base, d);
      if (t === "repostajes") comprobarKm(d, val);
      nuevosCoche[t] = val;
    }
    const retiradaVieja = gasto.enlace && d.movimientos.find((m) => m.id === gasto.enlace);
    const usarHucha = desdeHucha && partida && partida.frecuencia !== "Mensual" && gasto.importe > 0;
    const deHucha = usarHucha ? r2(Math.min(gasto.importe, Math.max(0, saldoHucha(d, retiradaVieja ? [retiradaVieja.id] : [])))) : 0;
    const cambios = [];

    if (deHucha > 0) {
      const retirada = {
        ...(retiradaVieja || { id: uid(), creado: ahora() }),
        tipo: "ahorro",
        objetivoId: OBJETIVO_FIJO.id,
        partidaId: null,
        importe: -deHucha,
        fecha: gasto.fecha,
        mes: gasto.mes ?? null,
        concepto: `Pago de ${partida.nombre}`.slice(0, 80),
        enlace: gasto.id,
      };
      gasto.enlace = retirada.id;
      if (retiradaVieja) Object.assign(retiradaVieja, retirada);
      else d.movimientos.push(retirada);
      cambios.push(subir("movimientos", retirada));
    } else {
      if (retiradaVieja) {
        d.movimientos = d.movimientos.filter((m) => m.id !== retiradaVieja.id);
        cambios.push(quitar("movimientos", retiradaVieja.id));
      }
      gasto.enlace = null;
    }

    if (existente) Object.assign(existente, gasto);
    else d.movimientos.push(gasto);
    cambios.unshift(subir("movimientos", gasto));

    const creados = antes.some((m) => m.id === gasto.enlace) || !gasto.enlace ? [] : [gasto.enlace];
    for (const t of TABLAS_ENLAZADAS) {
      const viejo = viejos[t];
      const nuevo = nuevosCoche[t];
      if (nuevo) {
        const i = d[t].findIndex((x) => x.id === nuevo.id);
        if (i >= 0) d[t][i] = nuevo;
        else d[t].push(nuevo);
        cambios.push(subir(t, nuevo));
        if (!viejo) creados.push(nuevo.id);
      } else if (viejo) {
        d[t] = d[t].filter((x) => x.id !== viejo.id);
        cambios.push(quitar(t, viejo.id));
      }
    }
    return {
      r: {
        ...gasto,
        deHucha,
        deCuenta: r2(gasto.importe - deHucha),
        repostaje: nuevosCoche.repostajes,
        mantenimiento: nuevosCoche.mantenimientos,
        deshacer: { antes, quitar: creados },
      },
      cambios,
    };
  },

  // ---------- Coche ----------
  crearVehiculo(d, b = {}) {
    const v = { ...validarVehiculo(b, d), id: idNuevo(b.id, d.vehiculos), creado: typeof b.creado === "string" ? b.creado : ahora() };
    d.vehiculos.push(v);
    return hecho(v, subir("vehiculos", v));
  },
  actualizarVehiculo(d, id, b = {}) {
    const actual = buscar(d.vehiculos, id, "ese vehículo");
    Object.assign(actual, validarVehiculo(b, d, actual));
    return hecho(actual, subir("vehiculos", actual));
  },
  // Borra el vehículo con sus repostajes, mantenimientos y recordatorios; los
  // gastos se quedan en Cuadra y sus partidas dejan de ser «del coche».
  borrarVehiculo(d, id) {
    buscar(d.vehiculos, id, "ese vehículo");
    const cambios = [];
    for (const t of ["repostajes", "mantenimientos", "recordatorios"]) {
      for (const x of d[t].filter((x) => x.vehiculoId === id)) cambios.push(quitar(t, x.id));
      d[t] = d[t].filter((x) => x.vehiculoId !== id);
    }
    for (const p of d.partidas.filter((p) => p.vehiculoId === id)) {
      Object.assign(p, { vehiculoId: null, pctCoche: null });
      cambios.push(subir("partidas", p));
    }
    d.vehiculos = d.vehiculos.filter((v) => v.id !== id);
    cambios.push(quitar("vehiculos", id));
    return hecho({ ok: true }, ...cambios);
  },
  crearRecordatorio(d, b = {}) {
    const r = { ...validarRecordatorio(b, d), id: idNuevo(b.id, d.recordatorios) };
    d.recordatorios.push(r);
    return hecho(r, subir("recordatorios", r));
  },
  actualizarRecordatorio(d, id, b = {}) {
    const actual = buscar(d.recordatorios, id, "ese recordatorio");
    Object.assign(actual, validarRecordatorio(b, d, actual), { id });
    return hecho(actual, subir("recordatorios", actual));
  },
  borrarRecordatorio(d, id) {
    buscar(d.recordatorios, id, "ese recordatorio");
    d.recordatorios = d.recordatorios.filter((r) => r.id !== id);
    return hecho({ ok: true }, quitar("recordatorios", id));
  },
  // Repostaje o mantenimiento suelto (sin gasto: no debería pasar, pero por si acaso)
  borrarRegistroCoche(d, tabla, id) {
    if (!TABLAS_ENLAZADAS.includes(tabla)) falla("Tabla no válida.");
    const x = buscar(d[tabla], id, "ese registro");
    if (x.movimientoId && d.movimientos.some((m) => m.id === x.movimientoId)) return op.borrarMovimiento(d, x.movimientoId);
    d[tabla] = d[tabla].filter((y) => y.id !== id);
    return hecho({ ok: true, borrados: [marcar(tabla, x)] }, quitar(tabla, id));
  },

  crearPartida(d, b = {}) {
    const p = normalizarPartida({ ...validarPartida(b), orden: siguienteOrden(d), activa: true, id: idNuevo(b.id, d.partidas) });
    d.partidas.push(p);
    return hecho(p, subir("partidas", p));
  },
  actualizarPartida(d, id, b = {}) {
    const actual = buscar(d.partidas, id, "esa partida");
    Object.assign(actual, normalizarPartida(validarPartida(b, actual)));
    return hecho(actual, subir("partidas", actual));
  },
  // Con gastos apuntados hay que decir qué hacer con ellos (opciones.movimientos):
  //  - "borrar": se borran también (con sus retiradas y registros del coche);
  //  - "hucha": pasan a ser ahorro a «Recibos no mensuales» (para la partida que
  //    se usaba a mano para apartar a la hucha).
  // Devuelve la partida y los movimientos como estaban, para «Deshacer».
  borrarPartida(d, id, opciones) {
    const partida = { ...buscar(d.partidas, id, "esa partida") };
    const suyos = d.movimientos.filter((m) => m.partidaId === id);
    const modo = opciones?.movimientos;
    if (suyos.length && modo !== "borrar" && modo !== "hucha")
      falla(`Tiene ${suyos.length} ${suyos.length === 1 ? "gasto apuntado" : "gastos apuntados"}: archívala en lugar de eliminarla.`, 409);
    const cambios = [];
    const antes = [];
    if (modo === "hucha") {
      for (const m of suyos) {
        antes.push({ ...m });
        Object.assign(m, { tipo: "ahorro", partidaId: null, objetivoId: OBJETIVO_FIJO.id, concepto: m.concepto || "Apartar a la hucha" });
        cambios.push(subir("movimientos", m));
      }
    } else if (modo === "borrar") {
      for (const m of suyos) {
        if (!d.movimientos.some((x) => x.id === m.id)) continue;
        const { r, cambios: c } = op.borrarMovimiento(d, m.id);
        antes.push(...r.borrados);
        cambios.push(...c);
      }
    }
    d.partidas = d.partidas.filter((p) => p.id !== id);
    cambios.push(quitar("partidas", id));
    return hecho({ ok: true, partida, antes }, ...cambios);
  },

  crearObjetivo(d, b = {}) {
    const o = { ...validarObjetivo(b), id: idNuevo(b.id, d.objetivos), creado: ahora() };
    d.objetivos.push(o);
    return hecho(o, subir("objetivos", o));
  },
  actualizarObjetivo(d, id, b = {}) {
    const actual = buscar(d.objetivos, id, "ese objetivo");
    Object.assign(actual, validarObjetivo(b, actual));
    return hecho(actual, subir("objetivos", actual));
  },
  borrarObjetivo(d, id) {
    buscar(d.objetivos, id, "ese objetivo");
    d.objetivos = d.objetivos.filter((o) => o.id !== id);
    return hecho({ ok: true }, quitar("objetivos", id));
  },

  crearSimulacion(d, b = {}) {
    const t = ahora();
    const s = { ...validarSimulacion(b), id: idNuevo(b.id, d.simulaciones), creado: t, actualizado: t };
    d.simulaciones.push(s);
    return hecho(s, subir("simulaciones", s));
  },
  actualizarSimulacion(d, id, b = {}) {
    const actual = buscar(d.simulaciones, id, "ese escenario");
    Object.assign(actual, validarSimulacion(b, actual), { actualizado: ahora() });
    return hecho(actual, subir("simulaciones", actual));
  },
  borrarSimulacion(d, id) {
    buscar(d.simulaciones, id, "ese escenario");
    d.simulaciones = d.simulaciones.filter((s) => s.id !== id);
    return hecho({ ok: true }, quitar("simulaciones", id));
  },

  // Convierte un escenario en el presupuesto real. Nada se borra: las partidas
  // que no estén en el escenario (o estén desactivadas) se archivan.
  aplicarSimulacion(d, id) {
    const s = buscar(d.simulaciones, id, "ese escenario");
    const usadas = new Set();
    const tocadas = new Set();
    let orden = siguienteOrden(d);
    for (const sp of s.partidas) {
      const real = sp.origenId && d.partidas.find((p) => p.id === sp.origenId);
      const campos = { nombre: sp.nombre, categoria: sp.categoria, importe: sp.importe, frecuencia: sp.frecuencia, recibo: sp.recibo, icono: sp.icono, activa: sp.activa };
      if (real) {
        Object.assign(real, normalizarPartida({ ...real, ...campos }));
        usadas.add(real.id);
        tocadas.add(real.id);
      } else if (sp.activa) {
        const nueva = normalizarPartida({ ...campos, id: uid(), orden: orden++ });
        d.partidas.push(nueva);
        usadas.add(nueva.id);
        tocadas.add(nueva.id);
      }
    }
    d.partidas.forEach((p) => {
      if (!usadas.has(p.id) && p.activa) {
        p.activa = false;
        tocadas.add(p.id);
      }
    });
    return hecho(
      { partidas: d.partidas },
      ...d.partidas.filter((p) => tocadas.has(p.id)).map((p) => subir("partidas", p))
    );
  },
};
