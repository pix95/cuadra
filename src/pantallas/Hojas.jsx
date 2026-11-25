// Ventanas que suben desde abajo: sueldo, partidas, objetivos, avisos, recibos, ajustes…
import { useMemo, useRef, useState } from "react";
import { Check, X, Search, Download, Upload, FileJson, TriangleAlert, Info, CircleAlert, ChevronRight, Archive, ArchiveRestore, Trash2, Plus, CalendarClock, RefreshCw, LogOut, Smartphone } from "lucide-react";
import { exportarCSV } from "../../shared/csv.js";
import { useDatos, useUI } from "../store.jsx";
import { Hoja, CampoImporte, Interruptor, Barra, BarraRayas } from "../components/comunes.jsx";
import { Ficha, Icono, ICONOS, ICONOS_OBJETIVO, colorCategoria } from "../lib/iconos.jsx";
import {
  presupuestoMensual, recibosMes, alertas, ordenar, ordenCategorias, esMensual, gastosPorPartida, movsDeMes, ahorradoObjetivo,
  FRECUENCIAS, CADA, resumenMes, estadoDe, porcentaje, acumuladoAño, anual,
} from "../lib/calculos.js";
import { eur, parseImporte, aInput, nombreMes, mesActual, moverMes, hoyISO, diasEnMes, MESES_CORTOS, mayus, fechaCorta, r2 } from "../lib/formato.js";

// ---------- Sueldo del mes ----------
export function HojaSueldo({ mes, inicioDeMes = false, cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const anteriores = Object.entries(db.meses)
    .filter(([m, v]) => m !== mes && v?.sueldo != null)
    .sort((a, b) => b[0].localeCompare(a[0]));
  const previo = anteriores.find(([m]) => m < mes)?.[1].sueldo ?? anteriores[0]?.[1].sueldo ?? db.ajustes.sueldoSugerido ?? null;
  const actual = db.meses[mes]?.sueldo ?? null;
  const [txt, setTxt] = useState(aInput(actual ?? previo ?? ""));
  const [error, setError] = useState("");
  const sugerencias = [...new Set([...anteriores.map(([, v]) => v.sueldo), db.ajustes.sueldoSugerido].filter((x) => x != null))].slice(0, 4);
  const pres = presupuestoMensual(db.partidas);
  const v = parseImporte(txt);
  const margen = Number.isFinite(v) ? r2(v - pres.total) : null;

  async function guardar(valor = v) {
    if (!Number.isFinite(valor) || valor < 0) return setError("Escribe el sueldo como un número, por ejemplo 1500 o 1.500,50.");
    try {
      await acc.ponerSueldo(mes, valor);
      cerrar();
      ui.avisar(inicioDeMes && actual == null ? `¡Mes empezado! ${eur(valor, { corto: true })} para ${nombreMes(mes)}` : `Sueldo de ${nombreMes(mes)}: ${eur(valor, { corto: true })}`);
    } catch (e) {
      setError(e.message);
    }
  }
  function posponer() {
    try {
      sessionStorage.setItem(`cuadra:sueldo-pospuesto:${mes}`, "1");
    } catch {
      /* nada */
    }
    cerrar();
  }
  async function quitar() {
    await acc.ponerSueldo(mes, null);
    cerrar();
    ui.avisar(`Sueldo de ${nombreMes(mes)} borrado`);
  }

  return (
    <Hoja
      titulo={inicioDeMes && actual == null ? `Empieza ${nombreMes(mes)}` : `Sueldo de ${nombreMes(mes, { año: true })}`}
      subtitulo={inicioDeMes && actual == null ? "¿Con qué sueldo empiezas el mes? Puedes cambiarlo cuando quieras." : "Lo que cobras este mes. Cada mes puede ser distinto."}
      onCerrar={inicioDeMes && actual == null ? posponer : cerrar}
      pie={
        <>
          {inicioDeMes && actual == null ? (
            <button type="button" className="btn" onClick={posponer}>
              Ahora no
            </button>
          ) : actual != null ? (
            <button type="button" className="btn btn-texto" onClick={quitar}>
              Quitar
            </button>
          ) : null}
          <button type="button" className="btn btn-primario" onClick={() => guardar()}>
            {inicioDeMes && actual == null ? "Empezar el mes" : "Guardar"}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <CampoImporte grande valor={txt} onCambio={setTxt} autoFocus etiqueta="Sueldo neto" placeholder="0,00" />
      </form>
      {sugerencias.length > 0 && (
        <div className="chips">
          {sugerencias.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => setTxt(aInput(s))}>
              {eur(s, { corto: true })}
            </button>
          ))}
        </div>
      )}
      <dl className="cuadre">
        <dt>Presupuesto mensual</dt>
        <dd>{eur(pres.total)}</dd>
        {margen != null && (
          <>
            <dt className="total">Margen con este sueldo</dt>
            <dd className={`total ${margen < 0 ? "negativo" : "positivo"}`}>{eur(margen, { signo: true })}</dd>
          </>
        )}
      </dl>
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}

// ---------- Partida del presupuesto ----------
export function HojaPartida({ partida = null, categoria = "", cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const [f, setF] = useState(() => ({
    nombre: partida?.nombre || "",
    categoria: partida?.categoria || categoria || "",
    importe: partida ? aInput(partida.importe) : "",
    frecuencia: partida?.frecuencia || "Mensual",
    recibo: partida?.recibo || false,
    icono: partida?.icono || "paquete",
  }));
  const [error, setError] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const categorias = ordenCategorias(db.partidas);
  const usos = partida ? db.movimientos.filter((m) => m.partidaId === partida.id).length : 0;
  const importe = f.importe.trim() === "" ? 0 : parseImporte(f.importe);

  async function guardar() {
    if (!f.nombre.trim()) return setError("Ponle un nombre a la partida.");
    if (!Number.isFinite(importe) || importe < 0) return setError("El importe debe ser un número, por ejemplo 45,90.");
    try {
      const r = await acc.guardarPartida({ ...(partida || {}), ...f, nombre: f.nombre.trim(), categoria: f.categoria.trim() || "Otros", importe });
      cerrar();
      ui.avisar(partida ? "Partida guardada" : `Partida «${r.nombre}» añadida`);
    } catch (e) {
      setError(e.message);
    }
  }
  async function archivar() {
    try {
      await acc.guardarPartida({ ...partida, activa: !partida.activa });
      cerrar();
      ui.avisar(partida.activa ? "Partida archivada" : "Partida reactivada", {
        texto: "Deshacer",
        fn: () => acc.guardarPartida(partida),
      });
    } catch (e) {
      setError(e.message);
    }
  }
  async function eliminar() {
    if (!confirmarBorrar) return setConfirmarBorrar(true);
    try {
      await acc.borrarPartida(partida.id);
      cerrar();
      ui.avisar("Partida eliminada");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Hoja
      titulo={partida ? "Editar partida" : "Nueva partida"}
      subtitulo={partida && usos ? `${usos} ${usos === 1 ? "movimiento apuntado" : "movimientos apuntados"}` : null}
      onCerrar={cerrar}
      pie={
        <>
          {partida && !usos && (
            <button type="button" className={`btn ${confirmarBorrar ? "btn-peligro" : "btn-texto"}`} onClick={eliminar}>
              <Trash2 size={16} /> {confirmarBorrar ? "¿Seguro?" : "Eliminar"}
            </button>
          )}
          {partida && (
            <button type="button" className="btn" onClick={archivar}>
              {partida.activa ? <Archive size={16} /> : <ArchiveRestore size={16} />} {partida.activa ? "Archivar" : "Reactivar"}
            </button>
          )}
          <button type="button" className="btn btn-primario" onClick={guardar}>
            {partida ? "Guardar" : "Añadir"}
          </button>
        </>
      }
    >
      <div className="partida-preview">
        <Ficha icono={f.icono} color={colorCategoria(f.categoria || "Otros")} size={52} />
        <span>
          <b>{f.nombre || "Nombre de la partida"}</b>
          <small>
            {f.categoria || "Otros"} · {eur(Number.isFinite(importe) ? importe : 0)} {CADA[f.frecuencia]}
          </small>
        </span>
      </div>
      <label className="campo">
        <span>Nombre</span>
        <input type="text" maxLength={60} value={f.nombre} onChange={(e) => set("nombre")(e.target.value)} placeholder="Ej.: Seguro hogar" autoFocus={!partida} />
      </label>
      <label className="campo">
        <span>Categoría</span>
        <input type="text" maxLength={40} value={f.categoria} onChange={(e) => set("categoria")(e.target.value)} placeholder="Ej.: Vivienda" list="lista-categorias" />
        <datalist id="lista-categorias">
          {categorias.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <div className="chips">
        {categorias.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={c === f.categoria} onClick={() => set("categoria")(c)}>
            {c}
          </button>
        ))}
      </div>
      <CampoImporte etiqueta={f.frecuencia === "Mensual" ? "Importe al mes" : "Importe de cada recibo"} valor={f.importe} onCambio={set("importe")} />
      <div className="campo">
        <span>Frecuencia</span>
        <div className="chips">
          {FRECUENCIAS.map((x) => (
            <button key={x} type="button" className="chip" aria-pressed={x === f.frecuencia} onClick={() => set("frecuencia")(x)}>
              {x}
            </button>
          ))}
        </div>
        {f.frecuencia !== "Mensual" && Number.isFinite(importe) && importe > 0 && (
          <small className="ayuda">
            Son {eur(importe * { Bimestral: 6, Trimestral: 4, Semestral: 2, Anual: 1 }[f.frecuencia])} al año: aparta {eur((importe * { Bimestral: 6, Trimestral: 4, Semestral: 2, Anual: 1 }[f.frecuencia]) / 12)} cada mes.
          </small>
        )}
      </div>
      <Interruptor activo={f.recibo} onCambio={set("recibo")} etiqueta="Es un recibo" descripcion="Un cargo que llega una vez por periodo (hipoteca, luz, gimnasio…). Sale en la lista de recibos." />
      <div className="campo">
        <span>Icono</span>
        <div className="iconos-rejilla">
          {Object.keys(ICONOS).map((k) => (
            <button key={k} type="button" aria-pressed={k === f.icono} onClick={() => set("icono")(k)} aria-label={k} title={k}>
              <Icono nombre={k} size={20} />
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}

// ---------- Objetivo de ahorro ----------
export function HojaObjetivo({ objetivo = null, onGuardado, cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const [f, setF] = useState(() => ({
    nombre: objetivo?.nombre || "",
    meta: objetivo ? aInput(objetivo.meta) : "",
    fecha: objetivo?.fecha || "",
    icono: objetivo?.icono || "hucha",
  }));
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const ahorrado = objetivo ? ahorradoObjetivo(db, objetivo.id) : 0;
  const meta = f.meta.trim() === "" ? 0 : parseImporte(f.meta);
  const aportaciones = objetivo ? db.movimientos.filter((m) => m.tipo === "ahorro" && m.objetivoId === objetivo.id) : [];

  // Cuánto apartar al mes para llegar a tiempo
  let alMes = null;
  if (meta > 0 && f.fecha) {
    const [y, m] = f.fecha.split("-").map(Number);
    const [hy, hm] = mesActual().split("-").map(Number);
    const meses = (y - hy) * 12 + (m - hm) + 1;
    if (meses > 0) alMes = Math.max(0, (meta - ahorrado) / meses);
  }

  async function guardar() {
    if (!f.nombre.trim()) return setError("Ponle un nombre al objetivo.");
    if (!Number.isFinite(meta) || meta < 0) return setError("La meta debe ser un número, por ejemplo 3000.");
    try {
      const r = await acc.guardarObjetivo({ ...(objetivo || {}), ...f, nombre: f.nombre.trim(), meta, fecha: f.fecha || null });
      cerrar();
      onGuardado?.(r);
      ui.avisar(objetivo ? "Objetivo guardado" : `Objetivo «${r.nombre}» creado`);
    } catch (e) {
      setError(e.message);
    }
  }
  async function eliminar() {
    if (!confirmar) return setConfirmar(true);
    await acc.borrarObjetivo(objetivo.id);
    cerrar();
    ui.avisar("Objetivo eliminado");
  }

  return (
    <Hoja
      titulo={objetivo ? objetivo.nombre : "Nuevo objetivo de ahorro"}
      subtitulo={objetivo ? `${eur(ahorrado)} ahorrados en ${aportaciones.length} ${aportaciones.length === 1 ? "aportación" : "aportaciones"}` : "Lo que apartes para él se descuenta de lo disponible del mes."}
      onCerrar={cerrar}
      pie={
        <>
          {objetivo && (
            <button type="button" className={`btn ${confirmar ? "btn-peligro" : "btn-texto"}`} onClick={eliminar}>
              <Trash2 size={16} /> {confirmar ? "¿Seguro?" : "Eliminar"}
            </button>
          )}
          {objetivo && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                cerrar();
                ui.abrir("apuntar", { tipo: "ahorro", objetivoId: objetivo.id });
              }}
            >
              <Plus size={16} /> Apartar
            </button>
          )}
          <button type="button" className="btn btn-primario" onClick={guardar}>
            {objetivo ? "Guardar" : "Crear"}
          </button>
        </>
      }
    >
      {objetivo && meta > 0 && (
        <div className="tarjeta objetivo plano">
          <div className="objetivo-cab">
            <span className="objetivo-txt">
              <b>{eur(ahorrado)}</b>
              <small>de {eur(meta)}</small>
            </span>
            <span className="objetivo-pct">
              <span>
                <em>{Math.round((ahorrado / meta) * 100)}</em>
                <i>%</i>
              </span>
            </span>
          </div>
          <BarraRayas pct={(ahorrado / meta) * 100} />
        </div>
      )}
      {confirmar && aportaciones.length > 0 && (
        <p className="aviso-linea">
          <TriangleAlert size={16} /> Sus {aportaciones.length} aportaciones se quedan en tu historial como «Ahorro».
        </p>
      )}
      <label className="campo">
        <span>Nombre</span>
        <input type="text" maxLength={50} value={f.nombre} onChange={(e) => set("nombre")(e.target.value)} placeholder="Ej.: Viaje a Japón" autoFocus={!objetivo} />
      </label>
      <div className="campos-2">
        <CampoImporte etiqueta="Meta" valor={f.meta} onCambio={set("meta")} placeholder="3.000" />
        <label className="campo">
          <span>Para cuándo</span>
          <input type="month" value={f.fecha} onChange={(e) => set("fecha")(e.target.value)} />
        </label>
      </div>
      {alMes != null && (
        <p className="ayuda">
          Para llegar a tiempo, aparta unos <b>{eur(alMes, { corto: true })}</b> al mes.
        </p>
      )}
      <div className="campo">
        <span>Icono</span>
        <div className="iconos-rejilla">
          {ICONOS_OBJETIVO.map((k) => (
            <button key={k} type="button" aria-pressed={k === f.icono} onClick={() => set("icono")(k)} aria-label={k}>
              <Icono nombre={k} size={20} />
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}

// ---------- Avisos ----------
const ICONO_NIVEL = { mal: CircleAlert, aviso: TriangleAlert, info: Info };
export function HojaAlertas({ cerrar }) {
  const { db } = useDatos();
  const ui = useUI();
  const lista = alertas(db, ui.mes);
  function ir(a) {
    cerrar();
    if (a.tipo === "sueldo") ui.abrir("sueldo", { mes: ui.mes });
    else if (a.tipo === "recibos") ui.abrir("recibos", { mes: ui.mes });
    else ui.irA("analisis");
  }
  return (
    <Hoja titulo="Avisos" subtitulo={`${mayus(nombreMes(ui.mes, { año: true }))}`} onCerrar={cerrar}>
      {lista.length ? (
        <div className="lista">
          {lista.map((a, i) => {
            const I = ICONO_NIVEL[a.nivel];
            return (
              <button key={i} type="button" className="alerta" data-nivel={a.nivel} onClick={() => ir(a)}>
                <I size={20} />
                <span>{a.texto}</span>
                <ChevronRight size={18} className="tenue" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="vacio">
          <Check size={28} />
          <strong>Todo en orden</strong>
          <p>No te has pasado en ninguna partida y no hay nada pendiente.</p>
        </div>
      )}
    </Hoja>
  );
}

// ---------- Recibos ----------
export function HojaRecibos({ mes, cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const recibos = recibosMes(db, mes);
  const periodicos = ordenar(db.partidas.filter((p) => p.activa && p.recibo && !esMensual(p) && p.importe > 0));
  const gMes = gastosPorPartida(movsDeMes(db, mes), db.partidas);
  const gAño = acumuladoAño(db, mes);
  const pendientes = recibos.filter((x) => !x.hecho);
  const fecha = mes === mesActual() ? hoyISO() : mes < mesActual() ? `${mes}-${String(diasEnMes(mes)).padStart(2, "0")}` : `${mes}-01`;
  const [ocupado, setOcupado] = useState(false);

  async function cargar(ps) {
    if (ocupado) return;
    setOcupado(true);
    try {
      const creados = [];
      for (const p of ps) creados.push(await acc.guardarMovimiento({ tipo: "gasto", fecha, importe: p.importe, partidaId: p.id, concepto: "" }));
      ui.avisar(ps.length === 1 ? `${ps[0].nombre}: ${eur(ps[0].importe)} cargado` : `${ps.length} recibos cargados`, {
        texto: "Deshacer",
        fn: async () => {
          for (const m of creados) await acc.borrarMovimiento(m.id);
        },
      });
    } catch (e) {
      ui.avisar(e.message, null, "mal");
    } finally {
      setOcupado(false);
    }
  }
  // Quitar la marca: se borran los cargos de ese recibo en el mes y el dinero vuelve a lo disponible
  async function desmarcar(p) {
    if (ocupado) return;
    const cargos = movsDeMes(db, mes).filter((m) => m.tipo === "gasto" && m.partidaId === p.id);
    if (!cargos.length) return;
    setOcupado(true);
    try {
      for (const m of cargos) await acc.borrarMovimiento(m.id);
      const total = cargos.reduce((s, m) => s + m.importe, 0);
      ui.avisar(`${p.nombre} desmarcado: vuelven ${eur(total)}`, {
        texto: "Deshacer",
        fn: async () => {
          for (const m of cargos) await acc.guardarMovimiento(m);
        },
      });
    } catch (e) {
      ui.avisar(e.message, null, "mal");
    } finally {
      setOcupado(false);
    }
  }
  const ultimo = (p) => {
    const ms = db.movimientos.filter((m) => m.partidaId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return ms[0];
  };

  return (
    <Hoja
      titulo={`Recibos de ${nombreMes(mes)}`}
      subtitulo="Marca cada recibo cuando te lo carguen y se apunta con su importe. Toca el ✓ para desmarcarlo: el dinero vuelve a lo disponible."
      onCerrar={cerrar}
      pie={
        pendientes.length > 1 ? (
          <button type="button" className="btn btn-primario" disabled={ocupado} onClick={() => cargar(pendientes.map((x) => x.partida))}>
            <Check size={16} /> Marcar los {pendientes.length} pendientes ({eur(pendientes.reduce((s, x) => s + x.partida.importe, 0), { corto: true })})
          </button>
        ) : null
      }
    >
      <div className="lista">
        {recibos.map(({ partida: p, pagado, hecho }) => (
          <div key={p.id} className={`recibo ${hecho ? "hecho" : ""}`}>
            <Ficha icono={p.icono} color={colorCategoria(p.categoria)} size={42} />
            <span className="recibo-txt">
              <b>{p.nombre}</b>
              <small>{hecho ? (Math.abs(pagado - p.importe) < 0.01 ? `Cargado ${eur(pagado)}` : `Cargado ${eur(pagado)} (previsto ${eur(p.importe)})`) : `Previsto ${eur(p.importe)}`}</small>
            </span>
            {hecho ? (
              <button type="button" className="recibo-ok" disabled={ocupado} onClick={() => desmarcar(p)} aria-label={`Desmarcar ${p.nombre}`} title="Desmarcar">
                <Check size={18} className="si" />
                <X size={18} className="no" />
              </button>
            ) : (
              <button type="button" className="chip" disabled={ocupado} onClick={() => cargar([p])}>
                Cargado
              </button>
            )}
          </div>
        ))}
      </div>
      {periodicos.length > 0 && (
        <>
          <h3 className="hoja-sub-titulo">
            <CalendarClock size={16} /> Recibos periódicos
          </h3>
          <div className="lista">
            {periodicos.map((p) => {
              const esteMes = r2(gMes.get(p.id) || 0);
              const u = ultimo(p);
              return (
                <div key={p.id} className={`recibo ${esteMes > 0 ? "hecho" : ""}`}>
                  <Ficha icono={p.icono} color={colorCategoria(p.categoria)} size={42} />
                  <span className="recibo-txt">
                    <b>{p.nombre}</b>
                    <small>
                      {eur(p.importe, { corto: true })} {CADA[p.frecuencia]} · {mes.slice(0, 4)}: {eur(gAño.get(p.id) || 0, { corto: true })} de {eur(anual(p), { corto: true })}
                      {u && esteMes <= 0 ? ` · último ${fechaCorta(u.fecha)}` : ""}
                    </small>
                  </span>
                  {esteMes > 0 ? (
                    <button type="button" className="recibo-ok" disabled={ocupado} onClick={() => desmarcar(p)} aria-label={`Desmarcar ${p.nombre}`} title="Desmarcar">
                      <Check size={18} className="si" />
                      <X size={18} className="no" />
                    </button>
                  ) : (
                    <button type="button" className="chip" disabled={ocupado} onClick={() => cargar([p])}>
                      Este mes
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Hoja>
  );
}

// ---------- Ajustes, cuenta y datos ----------
function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const TEXTO_SYNC = { ok: "Sincronizado", pendiente: "Cambios sin enviar", sincronizando: "Sincronizando…", offline: "Sin conexión", error: "Error al sincronizar", local: "Modo local" };

export function HojaAjustes({ cerrar }) {
  const { db, acc, motor, sync } = useDatos();
  const ui = useUI();
  const [nombre, setNombre] = useState(db.ajustes.nombre || "");
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState("");
  const [confirmarSalir, setConfirmarSalir] = useState(false);
  const archivo = useRef(null);
  const hoy = hoyISO();

  async function guardarNombre() {
    if (nombre.trim() === (db.ajustes.nombre || "")) return;
    await acc.guardarAjustes({ nombre: nombre.trim() });
    ui.avisar("Nombre guardado");
  }
  async function importar(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    setResumen(null);
    try {
      const buf = await f.arrayBuffer();
      let txt = new TextDecoder("utf-8").decode(buf);
      if (txt.includes("�")) txt = new TextDecoder("windows-1252").decode(buf); // CSV guardado desde Excel
      setResumen(await acc.importar(txt));
    } catch (err) {
      setError(err.message);
    }
  }
  async function salir() {
    if (sync.pendientes && !confirmarSalir) return setConfirmarSalir(true);
    cerrar();
    await motor.salir();
  }
  const cuando = sync.ultima ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sync.ultima)) : "todavía no";

  return (
    <Hoja titulo="Ajustes" onCerrar={cerrar}>
      <label className="campo">
        <span>Tu nombre (para el saludo)</span>
        <input type="text" maxLength={40} value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={guardarNombre} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="Opcional" />
      </label>

      {motor.necesitaCuenta ? (
        <>
          <h3 className="hoja-sub-titulo">Cuenta y sincronización</h3>
          <div className="cuenta">
            <p>
              Has entrado como <b>{sync.email}</b>
            </p>
            <p className="ayuda">
              <span className="estado-sync" data-estado={sync.estado} /> {TEXTO_SYNC[sync.estado] || sync.estado}
              {sync.pendientes ? ` · ${sync.pendientes} ${sync.pendientes === 1 ? "cambio" : "cambios"} por enviar` : ""} · última descarga: {cuando}
            </p>
            {sync.error && sync.estado === "error" && <p className="error">{sync.error}</p>}
            <div className="fila-botones">
              <button type="button" className="btn" onClick={() => motor.sincronizar()} disabled={sync.estado === "sincronizando"}>
                <RefreshCw size={16} /> Sincronizar ahora
              </button>
              <button type="button" className={`btn ${confirmarSalir ? "btn-peligro" : "btn-texto"}`} onClick={salir}>
                <LogOut size={16} /> {confirmarSalir ? `Perderás ${sync.pendientes} sin enviar. ¿Salir?` : "Cerrar sesión"}
              </button>
            </div>
          </div>
          <p className="ayuda">Puedes apuntar sin conexión: los cambios esperan en el dispositivo y se envían en cuanto vuelve internet.</p>
          <Instalar />
        </>
      ) : (
        <p className="ayuda" style={{ marginTop: 16 }}>
          Modo local: los datos están en la carpeta «datos» del servidor de Cuadra en este ordenador (archivo cuadra.json), con una copia diaria en «datos/copias».
        </p>
      )}

      <h3 className="hoja-sub-titulo">Tus datos</h3>
      <div className="botones-col">
        <button type="button" className="btn" onClick={() => descargar(`cuadra-movimientos-${hoy}.csv`, exportarCSV(db), "text/csv;charset=utf-8")}>
          <Download size={16} /> Exportar movimientos (CSV para Excel)
        </button>
        <button type="button" className="btn" onClick={() => descargar(`cuadra-copia-${hoy}.json`, JSON.stringify(db, null, 2), "application/json")}>
          <FileJson size={16} /> Descargar copia completa
        </button>
        <button type="button" className="btn" onClick={() => archivo.current?.click()}>
          <Upload size={16} /> Importar CSV
        </button>
        <input ref={archivo} type="file" accept=".csv,text/csv" hidden onChange={importar} />
      </div>
      <p className="ayuda">Acepta el CSV que exporta Cuadra (también el de la versión anterior). Si importas dos veces el mismo archivo no se duplica nada.</p>
      {resumen && (
        <div className="aviso-linea ok">
          <Check size={16} />
          <span>
            {resumen.importados} importados
            {resumen.repetidos ? `, ${resumen.repetidos} ya estaban` : ""}
            {resumen.errores ? `, ${resumen.errores} filas no válidas` : ""}.
            {resumen.partidasNuevas.length ? ` Partidas archivadas creadas: ${resumen.partidasNuevas.join(", ")}.` : ""}
          </span>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <p className="ayuda tenue">Cuadra 2.0 · {motor.tipo === "supabase" ? "datos en Supabase" : "datos en este ordenador"}</p>
    </Hoja>
  );
}

// Botón para instalar la app (Android/ordenador) o instrucciones (iPhone)
let eventoInstalar = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalar = e;
  });
}
function Instalar() {
  const [, refrescar] = useState(0);
  const instalada = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (instalada) return null;
  if (eventoInstalar) {
    return (
      <button
        type="button"
        className="btn btn-primario acceso-boton"
        onClick={async () => {
          eventoInstalar.prompt();
          await eventoInstalar.userChoice.catch(() => null);
          eventoInstalar = null;
          refrescar((n) => n + 1);
        }}
      >
        <Smartphone size={16} /> Instalar Cuadra
      </button>
    );
  }
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    return <p className="ayuda">Para tenerla como app en el iPhone: ábrela en Safari, pulsa Compartir y luego «Añadir a pantalla de inicio».</p>;
  }
  return null;
}

// ---------- Elegir partida ----------
export function HojaElegirPartida({ fecha, onElegir, cerrar }) {
  const { db } = useDatos();
  const [q, setQ] = useState("");
  const mes = (fecha || hoyISO()).slice(0, 7);
  const gp = gastosPorPartida(movsDeMes(db, mes), db.partidas);
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const activas = db.partidas.filter((p) => p.activa && (!q || norm(p.nombre + " " + p.categoria).includes(norm(q))));
  return (
    <Hoja titulo="Elige la partida" onCerrar={cerrar} className="hoja-alta">
      <label className="buscador">
        <Search size={18} />
        <input type="search" placeholder="Buscar partida…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      {ordenCategorias(activas).map((cat) => (
        <div key={cat} className="grupo">
          <h3 className="grupo-titulo">{cat}</h3>
          <div className="lista">
            {ordenar(activas.filter((p) => p.categoria === cat)).map((p) => {
              const g = gp.get(p.id) || 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="fila-partida"
                  onClick={() => {
                    onElegir(p.id);
                    cerrar();
                  }}
                >
                  <Ficha icono={p.icono} color={colorCategoria(p.categoria)} size={40} />
                  <span className="fila-partida-txt">
                    <b>{p.nombre}</b>
                    <small>{esMensual(p) ? (p.importe > 0 ? `${eur(Math.max(0, p.importe - g), { corto: true })} libres de ${eur(p.importe, { corto: true })}` : "Sin presupuesto") : `${p.frecuencia} · ${eur(p.importe, { corto: true })}`}</small>
                  </span>
                  {esMensual(p) && p.importe > 0 && <Barra pct={porcentaje(g, p.importe)} estado={estadoDe(g, p.importe)} />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!activas.length && <p className="ayuda">No hay ninguna partida con ese nombre.</p>}
    </Hoja>
  );
}

// ---------- Elegir mes ----------
export function HojaMeses({ cerrar }) {
  const { db } = useDatos();
  const ui = useUI();
  const act = mesActual();
  const meses = useMemo(() => {
    const conDatos = new Set([...db.movimientos.map((m) => m.fecha.slice(0, 7)), ...Object.keys(db.meses)]);
    const out = [];
    for (let i = -14; i <= 3; i++) out.push(moverMes(act, i));
    conDatos.forEach((m) => !out.includes(m) && out.push(m));
    return out.sort().reverse();
  }, [db, act]);
  const años = [...new Set(meses.map((m) => m.slice(0, 4)))];
  return (
    <Hoja titulo="Elige el mes" onCerrar={cerrar}>
      {años.map((y) => (
        <div key={y} className="grupo">
          <h3 className="grupo-titulo">{y}</h3>
          <div className="meses-rejilla">
            {meses
              .filter((m) => m.startsWith(y))
              .sort()
              .map((m) => {
                const r = resumenMes(db, m);
                const tiene = r.movs.length > 0 || r.sueldo != null;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={m === ui.mes}
                    className={`${m === act ? "hoy" : ""} ${tiene ? "" : "sin"}`}
                    onClick={() => {
                      ui.setMes(m);
                      cerrar();
                    }}
                  >
                    <b>{mayus(MESES_CORTOS[Number(m.slice(5)) - 1])}</b>
                    <small>{tiene ? eur(r.disponible, { corto: true }) : "—"}</small>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </Hoja>
  );
}

// ---------- Confirmación genérica ----------
export function HojaConfirmar({ titulo, texto, boton = "Confirmar", peligro = false, onConfirmar, cerrar }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <Hoja
      titulo={titulo}
      onCerrar={cerrar}
      pie={
        <>
          <button type="button" className="btn" onClick={cerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn ${peligro ? "btn-peligro" : "btn-primario"}`}
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              try {
                await onConfirmar();
                cerrar();
              } finally {
                setOcupado(false);
              }
            }}
          >
            {boton}
          </button>
        </>
      }
    >
      <div className="texto-confirmar">{texto}</div>
    </Hoja>
  );
}


// ---------- Apartar lo que sobró el mes pasado ----------
export function HojaCierre({ mes, importe, fecha, cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const [objetivoId, setObjetivoId] = useState(db.objetivos[0]?.id || "");
  const [txt, setTxt] = useState(aInput(importe));
  const [error, setError] = useState("");
  const valor = parseImporte(txt);

  async function apartar() {
    if (!objetivoId) return setError("Elige un objetivo.");
    if (!Number.isFinite(valor) || valor <= 0) return setError("Escribe un importe mayor que cero.");
    try {
      const m = await acc.guardarMovimiento({ tipo: "ahorro", fecha, importe: valor, objetivoId, concepto: `Sobrante de ${nombreMes(mes)}` });
      cerrar();
      const o = db.objetivos.find((x) => x.id === objetivoId);
      ui.avisar(`${eur(valor)} apartados para ${o?.nombre}`, { texto: "Deshacer", fn: () => acc.borrarMovimiento(m.id) });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Hoja
      titulo={`Cierre de ${nombreMes(mes)}`}
      subtitulo={`Te sobraron ${eur(importe)}. Se apunta como ahorro del último día de ${nombreMes(mes)}, así ese mes queda cuadrado.`}
      onCerrar={cerrar}
      pie={
        <button type="button" className="btn btn-primario" onClick={apartar}>
          Apartar {Number.isFinite(valor) && valor > 0 ? eur(valor, { corto: true }) : ""}
        </button>
      }
    >
      <CampoImporte grande etiqueta="Cuánto apartas" valor={txt} onCambio={setTxt} />
      <div className="campo">
        <span>Para qué objetivo</span>
        <div className="lista">
          {db.objetivos.map((o) => (
            <button key={o.id} type="button" className={`fila-partida elegible ${o.id === objetivoId ? "on" : ""}`} onClick={() => setObjetivoId(o.id)} aria-pressed={o.id === objetivoId}>
              <Ficha icono={o.icono} color="#f6a57c" size={40} />
              <span className="fila-partida-txt">
                <b>{o.nombre}</b>
                <small>
                  {eur(ahorradoObjetivo(db, o.id), { corto: true })} ahorrados{o.meta > 0 ? ` de ${eur(o.meta, { corto: true })}` : ""}
                </small>
              </span>
              {o.id === objetivoId && <Check size={18} className="positivo" />}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}

// ---------- Lo que ya tenías ahorrado antes de usar la app ----------
export function HojaAhorroInicial({ cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const actuales = db.movimientos.filter((m) => m.tipo === "inicial");
  const valorActual = actuales.reduce((s, m) => s + m.importe, 0);
  const [txt, setTxt] = useState(valorActual ? aInput(valorActual) : "");
  const [error, setError] = useState("");

  async function guardar() {
    const v = txt.trim() === "" ? 0 : parseImporte(txt);
    if (!Number.isFinite(v) || v < 0) return setError("Escribe una cantidad, por ejemplo 1500.");
    try {
      const [primero, ...resto] = actuales;
      for (const m of resto) await acc.borrarMovimiento(m.id);
      if (v === 0) {
        if (primero) await acc.borrarMovimiento(primero.id);
      } else if (primero) {
        await acc.guardarMovimiento({ ...primero, importe: v });
      } else {
        await acc.guardarMovimiento({ tipo: "inicial", fecha: hoyISO(), importe: v, concepto: "Ahorros que ya tenía" });
      }
      cerrar();
      ui.avisar(v ? `Ahorros previos: ${eur(v, { corto: true })}` : "Ahorros previos quitados");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Hoja
      titulo="Ahorros que ya tenías"
      subtitulo="Lo que tenías ahorrado antes de empezar con Cuadra. Se suma al total ahorrado, pero no cuenta en ningún mes ni en ningún objetivo."
      onCerrar={cerrar}
      pie={
        <button type="button" className="btn btn-primario" onClick={guardar}>
          Guardar
        </button>
      }
    >
      <CampoImporte grande autoFocus etiqueta="Cantidad" valor={txt} onCambio={setTxt} placeholder="0" />
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}
