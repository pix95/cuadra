// Reglas de los datos de Cuadra: validación y operaciones.
// Lo usan el servidor Node (server/) y la app cuando guarda en Supabase,
// así las dos se comportan igual.
//
// Cada operación recibe el estado completo, lo modifica y devuelve
// { r: resultado, cambios: [...] }. "cambios" son las filas tocadas, para
// poder enviarlas a la nube.

export const FRECUENCIAS = ["Mensual", "Bimestral", "Trimestral", "Semestral", "Anual"];
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
    importe: r2(Math.max(0, Number(p.importe) || 0)),
    frecuencia: FRECUENCIAS.includes(p.frecuencia) ? p.frecuencia : "Mensual",
    recibo: Boolean(p.recibo),
    icono: typeof p.icono === "string" && p.icono ? p.icono.slice(0, 30) : "paquete",
    orden: Number.isFinite(Number(p.orden)) ? Number(p.orden) : i,
    activa: p.activa !== false,
  };
}

export const estadoVacio = () => ({
  version: 2,
  ajustes: { nombre: "", sueldoSugerido: null },
  partidas: [],
  meses: {},
  movimientos: [],
  objetivos: [],
  simulaciones: [],
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
  d.partidas = (d.partidas || []).map((p, i) => normalizarPartida(p, i));
  d.meses = d.meses && typeof d.meses === "object" ? d.meses : {};
  d.movimientos = Array.isArray(d.movimientos) ? d.movimientos : [];
  d.objetivos = Array.isArray(d.objetivos) ? d.objetivos : [];
  d.simulaciones = Array.isArray(d.simulaciones) ? d.simulaciones : [];
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
  return p;
}

function validarMovimiento(b, d, base = {}) {
  const m = { ...base };
  const tipo = b.tipo ?? base.tipo ?? "gasto";
  if (!["gasto", "ingreso", "ahorro", "inicial"].includes(tipo)) falla("Tipo de movimiento no válido.");
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
  }
  return m;
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

// ---------- Operaciones ----------
const subir = (tabla, fila) => ({ tabla, tipo: "upsert", id: tabla === "meses" ? fila.mes : tabla === "ajustes" ? "yo" : fila.id, fila: { ...fila } });
const quitar = (tabla, id) => ({ tabla, tipo: "delete", id });
const hecho = (r, ...cambios) => ({ r, cambios });

export const op = {
  guardarAjustes(d, b = {}) {
    const nuevo = { ...d.ajustes };
    if ("nombre" in b) nuevo.nombre = texto(b.nombre, "El nombre", { max: 40 });
    if ("sueldoSugerido" in b) nuevo.sueldoSugerido = b.sueldoSugerido == null ? null : numero(b.sueldoSugerido, "El sueldo", { min: 0 });
    d.ajustes = nuevo;
    return hecho(nuevo, subir("ajustes", nuevo));
  },

  ponerSueldo(d, mes, valor) {
    if (!esMes(mes)) falla("Mes no válido.");
    const sueldo = valor == null || valor === "" ? null : numero(valor, "El sueldo", { min: 0, max: 1e7 });
    const cambios = [];
    if (sueldo == null) {
      delete d.meses[mes];
      cambios.push(quitar("meses", mes));
    } else {
      d.meses[mes] = { ...(d.meses[mes] || {}), sueldo };
      d.ajustes = { ...d.ajustes, sueldoSugerido: sueldo };
      cambios.push(subir("meses", { mes, sueldo }), subir("ajustes", d.ajustes));
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
  borrarMovimiento(d, id) {
    buscar(d.movimientos, id, "ese movimiento");
    d.movimientos = d.movimientos.filter((m) => m.id !== id);
    return hecho({ ok: true }, quitar("movimientos", id));
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
  borrarPartida(d, id) {
    buscar(d.partidas, id, "esa partida");
    const usos = d.movimientos.filter((m) => m.partidaId === id).length;
    if (usos) falla(`Tiene ${usos} ${usos === 1 ? "gasto apuntado" : "gastos apuntados"}: archívala en lugar de eliminarla.`, 409);
    d.partidas = d.partidas.filter((p) => p.id !== id);
    return hecho({ ok: true }, quitar("partidas", id));
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
