// Exportar e importar movimientos en CSV (separado por ";" para que Excel en
// español lo abra bien). La importación acepta también el CSV de la versión
// anterior de Cuadra: Fecha;Importe;Partida;Categoría;Concepto.
import { uid, r2, normalizarPartida, ErrorDatos, objetivosConFijo } from "./modelo.js";

const TIPOS = { gasto: "Gasto", ingreso: "Ingreso", ahorro: "Ahorro", inicial: "Ahorro previo" };

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
  const objetivos = new Map(objetivosConFijo(d).map((o) => [o.id, o]));
  const filas = [["Fecha", "Tipo", "Importe", "Partida", "Categoría", "Objetivo", "Concepto"]];
  [...d.movimientos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.creado).localeCompare(String(b.creado)))
    .forEach((m) => {
      const p = partidas.get(m.partidaId);
      const o = objetivos.get(m.objetivoId);
      filas.push([m.fecha, TIPOS[m.tipo] || m.tipo, Number(m.importe).toFixed(2).replace(".", ","), p ? p.nombre : "", p ? p.categoria : "", o ? o.nombre : "", m.concepto]);
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

  const resumen = { importados: 0, repetidos: 0, errores: 0, partidasNuevas: [], objetivosNuevos: [] };
  const cambiosPrevios = []; // partidas y objetivos nuevos (van antes que sus movimientos)
  const cambiosMovs = [];

  const partidaPorNombre = new Map(d.partidas.map((p) => [norm(p.nombre), p]));
  const objetivoPorNombre = new Map(objetivosConFijo(d).map((o) => [norm(o.nombre), o]));
  const nombrePartida = new Map(d.partidas.map((p) => [p.id, norm(p.nombre)]));
  const nombreObjetivo = new Map(objetivosConFijo(d).map((o) => [o.id, norm(o.nombre)]));
  const clave = (fecha, tipo, importe, nombre, concepto) => [fecha, tipo, Number(importe).toFixed(2), nombre, norm(concepto)].join("|");

  // Lo que ya está apuntado: si vuelves a importar el mismo archivo no se duplica
  const existentes = new Map();
  for (const m of d.movimientos) {
    const n = m.tipo === "gasto" ? nombrePartida.get(m.partidaId) : m.tipo === "ahorro" ? nombreObjetivo.get(m.objetivoId) : "";
    const k = clave(m.fecha, m.tipo, m.importe, n || "", m.concepto);
    existentes.set(k, (existentes.get(k) || 0) + 1);
  }
  let orden = d.partidas.length ? Math.max(...d.partidas.map((p) => p.orden)) + 1 : 0;

  for (const f of filas.slice(1)) {
    const fecha = leerFecha(f[iFecha]);
    const importe = leerImporte(f[iImporte]);
    const tipoTxt = iTipo >= 0 ? norm(f[iTipo]) : "gasto";
    const tipo = tipoTxt.startsWith("ingr") ? "ingreso" : tipoTxt.startsWith("ahorro previo") ? "inicial" : tipoTxt.startsWith("ahorr") ? "ahorro" : "gasto";
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
    }

    const k = clave(fecha, tipo, importe, nombre, concepto);
    if (existentes.get(k) > 0) {
      existentes.set(k, existentes.get(k) - 1);
      resumen.repetidos++;
      continue;
    }
    const m = { id: uid(), tipo, fecha, importe, partidaId, objetivoId, concepto, creado: new Date().toISOString() };
    d.movimientos.push(m);
    cambiosMovs.push({ tabla: "movimientos", tipo: "upsert", id: m.id, fila: { ...m } });
    resumen.importados++;
  }
  return { r: resumen, cambios: [...cambiosPrevios, ...cambiosMovs] };
}
