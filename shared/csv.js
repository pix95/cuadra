// Exportar e importar movimientos en CSV (separado por ";" para que Excel en
// español lo abra bien). La importación acepta también el CSV de la versión
// anterior de Cuadra: Fecha;Importe;Partida;Categoría;Concepto.
import { uid, r2, normalizarPartida, ErrorDatos, objetivosConFijo, cuentas, cuentaDeAjuste, TIPOS_MANTENIMIENTO, mesSiguiente } from "./modelo.js";

// Los "inicial" antiguos se exportan como ajuste de Ahorros principales
const TIPOS = { gasto: "Gasto", ingreso: "Ingreso", ahorro: "Ahorro", ajuste: "Ajuste", inicial: "Ajuste" };

// Nombres antiguos que ahora tienen otro nombre en el presupuesto ({ "antiguo": "nuevo" })
const ALIAS = {};

const celda = (c) => {
  c = String(c ?? "");
  return /[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
};
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

export function exportarCSV(d) {
  const partidas = new Map(d.partidas.map((p) => [p.id, p]));
  const objetivos = new Map(cuentas(d).map((o) => [o.id, o]));
  // Coche: el repostaje o el mantenimiento enlazado va en columnas aparte
  const vehiculos = new Map((d.vehiculos || []).map((v) => [v.id, v]));
  const repostaje = new Map((d.repostajes || []).filter((r) => r.movimientoId).map((r) => [r.movimientoId, r]));
  const mant = new Map((d.mantenimientos || []).filter((m) => m.movimientoId).map((m) => [m.movimientoId, m]));
  const dec = (n) => Number(n).toFixed(2).replace(".", ",");
  const filas = [["Fecha", "Tipo", "Importe", "Partida", "Categoría", "Objetivo", "Concepto", "Cuenta para", "Vehículo", "Litros", "Km", "Lleno", "Gasolinera", "Mantenimiento", "Taller", "Notas"]];
  [...d.movimientos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado).localeCompare(String(b.creado)))
    .forEach((m) => {
      const p = partidas.get(m.partidaId);
      // En los ajustes, la columna «Objetivo» es la cuenta ajustada
      const o = objetivos.get(m.tipo === "ajuste" || m.tipo === "inicial" ? cuentaDeAjuste(m) : m.objetivoId);
      const r = repostaje.get(m.id);
      const x = mant.get(m.id);
      const coche = r
        ? [vehiculos.get(r.vehiculoId)?.nombre || "", dec(r.litros), r.km, r.lleno ? "Sí" : "No", r.gasolinera, "", "", ""]
        : x
          ? [vehiculos.get(x.vehiculoId)?.nombre || "", "", x.km ?? "", "", "", TIPOS_MANTENIMIENTO[x.tipo] || x.tipo, x.taller, x.notas]
          : ["", "", "", "", "", "", "", ""];
      filas.push([m.fecha, TIPOS[m.tipo] || m.tipo, dec(m.importe), p ? p.nombre : "", p ? p.categoria : "", o ? o.nombre : "", m.concepto, m.mes || "", ...coche]);
    });
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
}

function parsear(txt) {
  txt = txt.replace(/^﻿/, "");
  const primera = txt.split(/\r?\n/, 1)[0];
  const sep = primera.includes(";") ? ";" : primera.includes("\t") ? "\t" : ",";
  const filas = [];
  let fila = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) {
      if (c === '"') {
        if (txt[i + 1] === '"') {
          campo += '"';
          i++;
        } else comillas = false;
      } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((x) => x.trim()));
}

function leerImporte(txt) {
  let s = String(txt ?? "").trim().replace(/[€\s ]/g, "").replace("−", "-");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return r2(parseFloat(s));
}

function leerFecha(txt) {
  const s = String(txt ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // 25/11/2026
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

// Modifica el estado y devuelve { r: resumen, cambios }
export function importarCSV(d, csv) {
  if (typeof csv !== "string" || !csv.trim()) throw new ErrorDatos("El archivo está vacío.");
  const filas = parsear(csv);
  if (filas.length < 2) throw new ErrorDatos("El archivo no tiene movimientos.");
  const cab = filas[0].map(norm);
  const col = (n) => cab.indexOf(n);
  const iFecha = col("fecha");
  const iImporte = col("importe");
  if (iFecha < 0 || iImporte < 0) throw new ErrorDatos("No reconozco el archivo: necesita columnas «Fecha» e «Importe».");
  const iTipo = col("tipo");
  const iPartida = col("partida");
  const iCategoria = col("categoria");
  const iObjetivo = col("objetivo");
  const iConcepto = col("concepto");
  const iMes = col("cuenta para");
  // Columnas del coche (opcionales)
  const iVehiculo = col("vehiculo");
  const iLitros = col("litros");
  const iKm = col("km");
  const iLleno = col("lleno");
  const iGasolinera = col("gasolinera");
  const iMant = col("mantenimiento");
  const iTaller = col("taller");
  const iNotas = col("notas");
  const celdaDe = (f, i) => (i >= 0 ? String(f[i] ?? "").trim() : "");
  const vehiculos = d.vehiculos || [];
  const tipoMant = new Map(Object.entries(TIPOS_MANTENIMIENTO).map(([k, t]) => [norm(t), k]));
  const cambiosCoche = [];

  const resumen = { importados: 0, repetidos: 0, errores: 0, partidasNuevas: [], objetivosNuevos: [], repostajes: 0, mantenimientos: 0, cocheSinVehiculo: 0 };
  const cambiosPrevios = []; // partidas y objetivos nuevos (van antes que sus movimientos)
  const cambiosMovs = [];

  const partidaPorNombre = new Map(d.partidas.map((p) => [norm(p.nombre), p]));
  const objetivoPorNombre = new Map(objetivosConFijo(d).map((o) => [norm(o.nombre), o]));
  const cuentaPorNombre = new Map(cuentas(d).map((o) => [norm(o.nombre), o]));
  const nombrePartida = new Map(d.partidas.map((p) => [p.id, norm(p.nombre)]));
  const nombreObjetivo = new Map(cuentas(d).map((o) => [o.id, norm(o.nombre)]));
  const clave = (fecha, tipo, importe, nombre, concepto) => [fecha, tipo, Number(importe).toFixed(2), nombre, norm(concepto)].join("|");

  // Lo que ya está apuntado: si vuelves a importar el mismo archivo no se duplica
  const existentes = new Map();
  for (const m of d.movimientos) {
    const n = m.tipo === "gasto" ? nombrePartida.get(m.partidaId) : m.tipo === "ahorro" ? nombreObjetivo.get(m.objetivoId) : m.tipo === "ajuste" || m.tipo === "inicial" ? nombreObjetivo.get(cuentaDeAjuste(m)) : "";
    const k = clave(m.fecha, m.tipo === "inicial" ? "ajuste" : m.tipo, m.importe, n || "", m.concepto);
    existentes.set(k, (existentes.get(k) || 0) + 1);
  }
  let orden = d.partidas.length ? Math.max(...d.partidas.map((p) => p.orden)) + 1 : 0;

  for (const f of filas.slice(1)) {
    const fecha = leerFecha(f[iFecha]);
    const importe = leerImporte(f[iImporte]);
    const tipoTxt = iTipo >= 0 ? norm(f[iTipo]) : "gasto";
    const tipo = tipoTxt.startsWith("ingr")
      ? "ingreso"
      : tipoTxt.startsWith("ajuste") || tipoTxt.startsWith("ahorro previo")
        ? "ajuste"
        : tipoTxt.startsWith("ahorr")
          ? "ahorro"
          : "gasto";
    const concepto = iConcepto >= 0 ? String(f[iConcepto] ?? "").trim().slice(0, 80) : "";
    if (!fecha || !Number.isFinite(importe) || importe === 0) {
      resumen.errores++;
      continue;
    }

    let partidaId = null;
    let objetivoId = null;
    let nombre = "";
    if (tipo === "gasto") {
      let n = norm(iPartida >= 0 ? f[iPartida] : "") || "sin partida";
      n = ALIAS[n] || n;
      let p = partidaPorNombre.get(n);
      if (!p) {
        // Partida que ya no existe: se crea archivada para conservar el historial
        const original = String((iPartida >= 0 && f[iPartida]) || "Sin partida").trim().slice(0, 60);
        p = normalizarPartida({ id: uid(), nombre: original, categoria: (iCategoria >= 0 && f[iCategoria]) || "Otros", importe: 0, orden: orden++, activa: false });
        d.partidas.push(p);
        partidaPorNombre.set(n, p);
        resumen.partidasNuevas.push(p.nombre);
        cambiosPrevios.push({ tabla: "partidas", tipo: "upsert", id: p.id, fila: { ...p } });
      }
      partidaId = p.id;
      nombre = norm(p.nombre);
    } else if (tipo === "ahorro") {
      const n = norm(iObjetivo >= 0 ? f[iObjetivo] : "") || "ahorro";
      let o = objetivoPorNombre.get(n);
      if (!o) {
        o = { id: uid(), nombre: String((iObjetivo >= 0 && f[iObjetivo]) || "Ahorro").trim().slice(0, 50), meta: 0, fecha: null, icono: "hucha", creado: new Date().toISOString() };
        d.objetivos.push(o);
        objetivoPorNombre.set(n, o);
        resumen.objetivosNuevos.push(o.nombre);
        cambiosPrevios.push({ tabla: "objetivos", tipo: "upsert", id: o.id, fila: { ...o } });
      }
      objetivoId = o.id;
      nombre = norm(o.nombre);
    } else if (tipo === "ajuste") {
      // La cuenta tiene que existir; sin nombre (CSV antiguo «Ahorro previo») es Ahorros principales
      const n = norm(iObjetivo >= 0 ? f[iObjetivo] : "") || norm("Ahorros principales");
      const c = cuentaPorNombre.get(n);
      if (!c) {
        resumen.errores++;
        continue;
      }
      objetivoId = c.id;
      nombre = norm(c.nombre);
    }

    const k = clave(fecha, tipo, importe, nombre, concepto);
    if (existentes.get(k) > 0) {
      existentes.set(k, existentes.get(k) - 1);
      resumen.repetidos++;
      continue;
    }
    // «Cuenta para»: solo vale el mes siguiente al de la fecha (si no, el de la fecha)
    const mesTxt = iMes >= 0 ? String(f[iMes] ?? "").trim() : "";
    const mes = tipo !== "ajuste" && mesTxt === mesSiguiente(fecha.slice(0, 7)) ? mesTxt : null;
    const m = { id: uid(), tipo, fecha, importe, partidaId, objetivoId, concepto, mes, creado: new Date().toISOString() };
    d.movimientos.push(m);
    cambiosMovs.push({ tabla: "movimientos", tipo: "upsert", id: m.id, fila: { ...m } });
    resumen.importados++;

    // Repostaje o mantenimiento del gasto: al vehículo con ese nombre, o al que
    // use esa partida, o al único que haya
    const litros = leerImporte(celdaDe(f, iLitros));
    const kmTxt = celdaDe(f, iKm).replace(/\D/g, "");
    const km = kmTxt ? Number(kmTxt) : null;
    const tMant = tipoMant.get(norm(celdaDe(f, iMant)));
    if (tipo === "gasto" && ((litros > 0 && km != null) || tMant)) {
      const nv = norm(celdaDe(f, iVehiculo));
      const v =
        (nv && vehiculos.find((x) => norm(x.nombre) === nv)) ||
        vehiculos.find((x) => (tMant ? x.partidaMantenimiento : x.partidaCombustible) === partidaId) ||
        (vehiculos.length === 1 ? vehiculos[0] : null);
      if (!v) resumen.cocheSinVehiculo++;
      else if (tMant) {
        const x = { id: uid(), vehiculoId: v.id, fecha, km, tipo: tMant, importe, taller: celdaDe(f, iTaller).slice(0, 60), notas: celdaDe(f, iNotas).slice(0, 300), movimientoId: m.id };
        d.mantenimientos.push(x);
        cambiosCoche.push({ tabla: "mantenimientos", tipo: "upsert", id: x.id, fila: { ...x } });
        resumen.mantenimientos++;
      } else {
        const lleno = !/^n/.test(norm(celdaDe(f, iLleno)));
        const x = { id: uid(), vehiculoId: v.id, fecha, km, litros, importe, lleno, gasolinera: celdaDe(f, iGasolinera).slice(0, 60), movimientoId: m.id };
        d.repostajes.push(x);
        cambiosCoche.push({ tabla: "repostajes", tipo: "upsert", id: x.id, fila: { ...x } });
        resumen.repostajes++;
      }
    }
  }
  return { r: resumen, cambios: [...cambiosPrevios, ...cambiosMovs, ...cambiosCoche] };
}
