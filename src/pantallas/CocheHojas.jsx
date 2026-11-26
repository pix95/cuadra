// Ventanas del coche: vehículo (y asistente), repostaje, mantenimiento y recordatorio.
import { useState } from "react";
import { Check, Trash2, Fuel, Wrench, Car, BellRing } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Hoja, CampoImporte, Interruptor, Segmentado } from "../components/comunes.jsx";
import {
  ordenar, esMensual, vehiculoPrincipal, kmEstimados, ahorradoObjetivo, OBJETIVO_FIJO, recordatorioDeMantenimiento, siguienteRecordatorio,
  nombreRecordatorio, NOMBRES_RECORDATORIO, repostajesDe,
} from "../lib/calculos.js";
import { COMBUSTIBLES, TIPOS_MANTENIMIENTO } from "../../shared/modelo.js";
import { eur, parseImporte, aInput, hoyISO, fechaCorta, r2 } from "../lib/formato.js";
import { num, kmTxt, unidad } from "./Coche.jsx";

const NUEVA = "__nueva";
const leerKm = (t) => {
  const s = String(t ?? "").replace(/\D/g, "");
  return s === "" ? null : Number(s);
};
const kmInput = (n) => (n == null ? "" : String(n));

// Elegir partida (o crear una nueva con un nombre propuesto)
function ElegirPartida({ etiqueta, valor, onCambio, nueva, db }) {
  const activas = ordenar(db.partidas.filter((p) => p.activa));
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <select className="select" value={valor} onChange={(e) => onCambio(e.target.value)}>
        <option value="">Ninguna</option>
        {activas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} ({p.categoria})
          </option>
        ))}
        <option value={NUEVA}>➕ Crear «{nueva}»</option>
      </select>
    </label>
  );
}

// ---------- Vehículo (la primera vez, como asistente) ----------
export function HojaVehiculo({ vehiculo = null, asistente = false, cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const activas = db.partidas.filter((p) => p.activa);
  const busca = (re) => activas.find((p) => re.test(p.nombre))?.id;
  const [f, setF] = useState(() => ({
    nombre: vehiculo?.nombre || "Mi coche",
    combustible: vehiculo?.combustible || "gasolina",
    km: vehiculo ? kmInput(vehiculo.kmIniciales) : "",
    partidaCombustible: vehiculo ? vehiculo.partidaCombustible || "" : busca(/gasolina|combustible|gasóleo|gasoil|carburante/i) || NUEVA,
    partidaMantenimiento: vehiculo ? vehiculo.partidaMantenimiento || "" : busca(/manten|taller/i) || NUEVA,
  }));
  const [error, setError] = useState("");
  const [borrar, setBorrar] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  async function crearSiHaceFalta(valor, datos) {
    if (valor !== NUEVA) return valor || null;
    const p = await acc.guardarPartida({ categoria: "Transporte", importe: 0, frecuencia: "Mensual", recibo: false, ...datos });
    return p.id;
  }

  async function guardar() {
    const km = leerKm(f.km);
    if (km == null) return setError(vehiculo ? "Escribe los km." : "Escribe los km que marca ahora el cuentakilómetros.");
    try {
      const partidaCombustible = await crearSiHaceFalta(f.partidaCombustible, { nombre: f.combustible === "electrico" ? "Recarga coche" : "Gasolina", icono: "gasolina" });
      const partidaMantenimiento = await crearSiHaceFalta(f.partidaMantenimiento, { nombre: "Mantenimiento coche", icono: "taller", frecuencia: "Anual" });
      await acc.guardarVehiculo({ ...(vehiculo || {}), nombre: f.nombre, combustible: f.combustible, kmIniciales: km, partidaCombustible, partidaMantenimiento });
      cerrar();
      ui.avisar(vehiculo ? "Coche guardado" : `¡Listo! Ya puedes repostar con ${f.nombre.trim() || "tu coche"}`);
      if (!vehiculo) ui.irA("coche");
    } catch (e) {
      setError(e.message);
    }
  }

  async function eliminar() {
    if (!borrar) return setBorrar(true);
    try {
      await acc.borrarVehiculo(vehiculo.id);
      cerrar();
      ui.avisar("Coche eliminado. Sus gastos siguen en Cuadra.");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Hoja
      titulo={vehiculo ? "Ajustes del coche" : "Tu coche"}
      subtitulo={
        vehiculo
          ? "Nombre, combustible y en qué partidas de Cuadra se apuntan sus gastos."
          : "Tres datos y listo. El consumo aparece a partir del segundo repostaje con el depósito lleno."
      }
      onCerrar={cerrar}
      pie={
        <>
          {vehiculo && (
            <button type="button" className={`btn ${borrar ? "btn-peligro" : "btn-texto"}`} onClick={eliminar}>
              <Trash2 size={16} /> {borrar ? "¿Seguro?" : "Eliminar"}
            </button>
          )}
          <button type="button" className="btn btn-primario" onClick={guardar}>
            {vehiculo ? <Check size={17} /> : <Car size={17} />} {vehiculo ? "Guardar" : "Empezar"}
          </button>
        </>
      }
    >
      <label className="campo">
        <span>Nombre</span>
        <input value={f.nombre} maxLength={40} onChange={(e) => set("nombre")(e.target.value)} placeholder="Mi coche" autoFocus={asistente} />
      </label>
      <div className="campo">
        <span>Combustible</span>
        <Segmentado peq etiqueta="Combustible" valor={f.combustible} onCambio={set("combustible")} opciones={Object.entries(COMBUSTIBLES).map(([valor, texto]) => ({ valor, texto }))} />
      </div>
      <label className="campo">
        <span>{vehiculo ? "Km al empezar el cuaderno" : "Km que marca ahora"}</span>
        <input inputMode="numeric" value={f.km} onChange={(e) => set("km")(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Ej.: 85000" />
      </label>
      <ElegirPartida db={db} etiqueta="Partida del combustible" valor={f.partidaCombustible} onCambio={set("partidaCombustible")} nueva={f.combustible === "electrico" ? "Recarga coche" : "Gasolina"} />
      <ElegirPartida db={db} etiqueta="Partida del mantenimiento" valor={f.partidaMantenimiento} onCambio={set("partidaMantenimiento")} nueva="Mantenimiento coche" />
      <p className="ayuda">
        Lo que apuntes en estas partidas cuenta como gasto del coche. Si la de mantenimiento no es mensual, se paga desde la hucha «Recibos no mensuales». El seguro o el impuesto: márcalos como «Es del coche» en Presupuesto.
      </p>
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}

// ---------- Repostar ----------
export function HojaRepostaje({ repostaje = null, vehiculoId, cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const v = db.vehiculos.find((x) => x.id === (repostaje?.vehiculoId || vehiculoId)) || vehiculoPrincipal(db);
  const mov = repostaje?.movimientoId ? db.movimientos.find((m) => m.id === repostaje.movimientoId) : null;
  const u = unidad(v);
  const [importe, setImporte] = useState(repostaje ? aInput(repostaje.importe) : "");
  const [litros, setLitros] = useState(repostaje ? aInput(repostaje.litros) : "");
  const [km, setKm] = useState(kmInput(repostaje ? repostaje.km : kmEstimados(db, v)));
  const [lleno, setLleno] = useState(repostaje ? repostaje.lleno : true);
  const [fecha, setFecha] = useState(repostaje?.fecha || hoyISO());
  const [gasolinera, setGasolinera] = useState(repostaje?.gasolinera || "");
  const [error, setError] = useState("");
  const [borrar, setBorrar] = useState(false);
  const imp = parseImporte(importe);
  const lit = parseImporte(litros);
  const precio = imp > 0 && lit > 0 ? imp / lit : null;
  const ultimas = [...new Set(repostajesDe(db, v.id).reverse().map((r) => r.gasolinera).filter(Boolean))].slice(0, 4);

  async function guardar() {
    if (!db.partidas.some((p) => p.id === v.partidaCombustible)) return setError("Elige la partida del combustible en los ajustes del coche.");
    if (!(imp > 0)) return setError("Escribe cuánto has pagado.");
    if (!(lit > 0)) return setError(`Escribe los ${u === "l" ? "litros" : "kWh"}.`);
    if (leerKm(km) == null) return setError("Escribe los km del cuentakilómetros.");
    const b = { ...(mov || {}), tipo: "gasto", partidaId: mov?.partidaId || v.partidaCombustible, fecha, importe: imp, concepto: gasolinera.trim() || (mov?.concepto ?? "") };
    try {
      const r = await acc.guardarGasto(b, {
        desdeHucha: Boolean(mov?.enlace),
        repostaje: { ...(repostaje ? { id: repostaje.id } : {}), vehiculoId: v.id, km: leerKm(km), litros: lit, lleno, gasolinera: gasolinera.trim() },
      });
      cerrar();
      const txt = `${eur(imp)} · ${num(lit, 2)} ${u} a ${num(precio, 3)} €/${u}`;
      if (mov) ui.avisar(`Repostaje actualizado: ${txt}`, { texto: "Deshacer", fn: () => acc.restaurarMovimientos(r.deshacer.antes, r.deshacer.quitar) });
      else ui.avisar(`Repostaje apuntado: ${txt}`, { texto: "Deshacer", fn: () => acc.borrarMovimiento(r.id) });
    } catch (e) {
      setError(e.message);
    }
  }

  async function eliminar() {
    if (!borrar) return setBorrar(true);
    try {
      const r = mov ? await acc.borrarMovimiento(mov.id) : await acc.borrarRegistroCoche("repostajes", repostaje.id);
      cerrar();
      ui.avisar("Repostaje y su gasto eliminados", { texto: "Deshacer", fn: () => acc.restaurarMovimientos(r.borrados) });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Hoja
      titulo={repostaje ? "Repostaje" : "Repostar"}
      subtitulo={`${v.nombre}: se apunta también como gasto en ${db.partidas.find((p) => p.id === v.partidaCombustible)?.nombre || "la partida del combustible"}.`}
      onCerrar={cerrar}
      pie={
        <>
          {repostaje && (
            <button type="button" className={`btn ${borrar ? "btn-peligro" : "btn-texto"}`} onClick={eliminar}>
              <Trash2 size={16} /> {borrar ? "¿Seguro?" : "Eliminar"}
            </button>
          )}
          <button type="button" className="btn btn-primario" onClick={guardar}>
            <Fuel size={17} /> {repostaje ? "Guardar" : "Apuntar"}
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
        <CampoImporte grande autoFocus={!repostaje} etiqueta="Importe" valor={importe} onCambio={setImporte} placeholder="0,00" />
        <div className="campos-2">
          <label className="campo">
            <span>{u === "l" ? "Litros" : "kWh"}</span>
            <input inputMode="decimal" value={litros} onChange={(e) => setLitros(e.target.value)} placeholder="0,00" />
          </label>
          <label className="campo">
            <span>Km del cuentakilómetros</span>
            <input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
          </label>
        </div>
        <button type="submit" hidden />
      </form>
      <p className={`aviso-linea ${precio ? "ok" : ""}`}>
        {precio ? `Precio: ${num(precio, 3)} €/${u}` : `El precio por ${u === "l" ? "litro" : "kWh"} sale al escribir el importe y los ${u === "l" ? "litros" : "kWh"}.`}
        {!repostaje && leerKm(km) === kmEstimados(db, v) && " · Km propuestos con tu media: revísalos."}
      </p>
      <Interruptor activo={lleno} onCambio={setLleno} etiqueta="Depósito lleno" descripcion="Para el consumo de lleno a lleno. Desmárcalo si solo has echado un poco." />
      <div className="campos-2">
        <label className="campo">
          <span>Fecha</span>
          <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </label>
        <label className="campo">
          <span>Gasolinera (opcional)</span>
          <input value={gasolinera} maxLength={60} onChange={(e) => setGasolinera(e.target.value)} placeholder="Dónde" />
        </label>
      </div>
      {ultimas.length > 0 && (
        <div className="chips">
          {ultimas.map((g) => (
            <button key={g} type="button" className="chip" aria-pressed={g === gasolinera} onClick={() => setGasolinera(g)}>
              {g}
            </button>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}

// ---------- Mantenimiento ----------
export function HojaMantenimiento({ mantenimiento = null, vehiculoId, cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const v = db.vehiculos.find((x) => x.id === (mantenimiento?.vehiculoId || vehiculoId)) || vehiculoPrincipal(db);
  const mov = mantenimiento?.movimientoId ? db.movimientos.find((m) => m.id === mantenimiento.movimientoId) : null;
  const partida = db.partidas.find((p) => p.id === (mov?.partidaId || v.partidaMantenimiento));
  const [tipo, setTipo] = useState(mantenimiento?.tipo || "revision");
  const [importe, setImporte] = useState(mantenimiento ? aInput(mantenimiento.importe) : "");
  const [fecha, setFecha] = useState(mantenimiento?.fecha || hoyISO());
  const [km, setKm] = useState(kmInput(mantenimiento ? mantenimiento.km : null));
  const [taller, setTaller] = useState(mantenimiento?.taller || "");
  const [notas, setNotas] = useState(mantenimiento?.notas || "");
  const [desdeHucha, setDesdeHucha] = useState(mov ? Boolean(mov.enlace) : true);
  const [error, setError] = useState("");
  const [borrar, setBorrar] = useState(false);
  const imp = parseImporte(importe);
  // Si la partida no es mensual, se paga desde la hucha (como en Apuntar)
  const conHucha = partida && !esMensual(partida);
  const retiradaVieja = mov?.enlace ? db.movimientos.find((m) => m.id === mov.enlace) : null;
  const saldoHucha = r2(ahorradoObjetivo(db, OBJETIVO_FIJO.id) - (retiradaVieja?.importe || 0));
  const deHucha = conHucha && desdeHucha && imp > 0 ? r2(Math.min(imp, Math.max(0, saldoHucha))) : 0;

  async function guardar() {
    if (!partida) return setError("Elige la partida del mantenimiento en los ajustes del coche.");
    if (!(imp > 0)) return setError("Escribe cuánto ha costado.");
    const b = { ...(mov || {}), tipo: "gasto", partidaId: partida.id, fecha, importe: imp, concepto: mov?.concepto || TIPOS_MANTENIMIENTO[tipo] + (taller.trim() ? ` · ${taller.trim()}` : "") };
    try {
      const kmN = leerKm(km);
      const r = await acc.guardarGasto(b, {
        desdeHucha: conHucha && desdeHucha,
        mantenimiento: { ...(mantenimiento ? { id: mantenimiento.id } : {}), vehiculoId: v.id, tipo, km: kmN, taller: taller.trim(), notas: notas.trim() },
      });
      cerrar();
      const hucha = r.deHucha ? ` · ${eur(r.deHucha, { corto: true })} de la hucha` : "";
      if (mov) ui.avisar(`Mantenimiento actualizado${hucha}`, { texto: "Deshacer", fn: () => acc.restaurarMovimientos(r.deshacer.antes, r.deshacer.quitar) });
      else ui.avisar(`${TIPOS_MANTENIMIENTO[tipo]}: ${eur(imp)}${hucha}`, { texto: "Deshacer", fn: () => acc.borrarMovimiento(r.id) });
      // Si hay un recordatorio de ese tipo, propone moverlo a la siguiente vez
      const rec = !mantenimiento && recordatorioDeMantenimiento(db, v.id, tipo);
      if (rec) {
        const sig = siguienteRecordatorio(rec, fecha, kmN);
        if (sig.proximaFecha !== rec.proximaFecha || sig.proximosKm !== rec.proximosKm) {
          const partes = [sig.proximaFecha && `el ${fechaCorta(sig.proximaFecha)} de ${sig.proximaFecha.slice(0, 4)}`, sig.proximosKm != null && `a los ${kmTxt(sig.proximosKm)}`].filter(Boolean);
          ui.abrir("confirmar", {
            titulo: `¿Actualizo el recordatorio de ${nombreRecordatorio(rec)}?`,
            texto: `La próxima vez sería ${partes.join(" o ")}${partes.length > 1 ? ", lo que llegue antes" : ""}.`,
            boton: "Actualizar",
            onConfirmar: async () => {
              await acc.guardarRecordatorio({ ...rec, ...sig });
              ui.avisar(`${nombreRecordatorio(rec)}: próxima ${partes.join(" o ")}`);
            },
          });
        } else if (!rec.repetirMeses && !rec.repetirKm) {
          ui.abrir("recordatorio", { recordatorio: rec, vehiculoId: v.id, aviso: "Ya has hecho este mantenimiento: pon cuándo toca el siguiente." });
        }
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function eliminar() {
    if (!borrar) return setBorrar(true);
    try {
      const r = mov ? await acc.borrarMovimiento(mov.id) : await acc.borrarRegistroCoche("mantenimientos", mantenimiento.id);
      cerrar();
      ui.avisar("Mantenimiento y su gasto eliminados", { texto: "Deshacer", fn: () => acc.restaurarMovimientos(r.borrados) });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Hoja
      titulo={mantenimiento ? "Mantenimiento" : "Añadir mantenimiento"}
      subtitulo={`${v.nombre}: se apunta también como gasto en ${partida?.nombre || "la partida del mantenimiento"}.`}
      onCerrar={cerrar}
      pie={
        <>
          {mantenimiento && (
            <button type="button" className={`btn ${borrar ? "btn-peligro" : "btn-texto"}`} onClick={eliminar}>
              <Trash2 size={16} /> {borrar ? "¿Seguro?" : "Eliminar"}
            </button>
          )}
          <button type="button" className="btn btn-primario" onClick={guardar}>
            <Wrench size={17} /> {mantenimiento ? "Guardar" : "Apuntar"}
          </button>
        </>
      }
    >
      <div className="chips" role="group" aria-label="Tipo de mantenimiento">
        {Object.entries(TIPOS_MANTENIMIENTO).map(([k, t]) => (
          <button key={k} type="button" className="chip" aria-pressed={tipo === k} onClick={() => setTipo(k)}>
            {t}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <CampoImporte grande etiqueta="Importe" valor={importe} onCambio={setImporte} placeholder="0,00" />
        <button type="submit" hidden />
      </form>
      {conHucha && (
        <>
          <Interruptor activo={desdeHucha} onCambio={setDesdeHucha} etiqueta="Pagar desde la hucha" descripcion={`«Recibos no mensuales» tiene ${eur(saldoHucha)}`} />
          {desdeHucha && imp > 0 && (
            <p className="pago-hucha-reparto">
              De la hucha <b>{eur(deHucha)}</b> · de tu cuenta <b>{eur(r2(imp - deHucha))}</b>
            </p>
          )}
        </>
      )}
      <div className="campos-2">
        <label className="campo">
          <span>Fecha</span>
          <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </label>
        <label className="campo">
          <span>Km (opcional)</span>
          <input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/[^\d.]/g, ""))} placeholder={String(kmEstimados(db, v))} />
        </label>
      </div>
      <label className="campo">
        <span>Taller (opcional)</span>
        <input value={taller} maxLength={60} onChange={(e) => setTaller(e.target.value)} />
      </label>
      <label className="campo">
        <span>Notas (opcional)</span>
        <textarea rows={2} maxLength={300} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Qué se ha hecho" />
      </label>
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}

// ---------- Recordatorio ----------
// Repeticiones habituales al crear uno (se pueden cambiar)
const PROPUESTAS = { itv: { meses: 12 }, revision: { meses: 12, km: 15000 }, seguro: { meses: 12 }, impuesto: { meses: 12 }, aceite: { meses: 12, km: 10000 }, otro: {} };

export function HojaRecordatorio({ recordatorio = null, vehiculoId, tipo: tipoInicial = "itv", aviso = "", cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const v = db.vehiculos.find((x) => x.id === (recordatorio?.vehiculoId || vehiculoId)) || vehiculoPrincipal(db);
  const [f, setF] = useState(() => {
    const t = recordatorio?.tipo || tipoInicial;
    return {
      tipo: t,
      nota: recordatorio?.nota || "",
      proximaFecha: recordatorio?.proximaFecha || "",
      proximosKm: kmInput(recordatorio?.proximosKm),
      repetirMeses: recordatorio ? kmInput(recordatorio.repetirMeses) : kmInput(PROPUESTAS[t].meses),
      repetirKm: recordatorio ? kmInput(recordatorio.repetirKm) : kmInput(PROPUESTAS[t].km),
    };
  });
  const [error, setError] = useState("");
  const [borrar, setBorrar] = useState(false);
  const set = (k) => (val) => setF((x) => ({ ...x, [k]: val }));
  function cambiarTipo(t) {
    setF((x) => (recordatorio ? { ...x, tipo: t } : { ...x, tipo: t, repetirMeses: kmInput(PROPUESTAS[t].meses), repetirKm: kmInput(PROPUESTAS[t].km) }));
  }

  async function guardar() {
    try {
      await acc.guardarRecordatorio({
        ...(recordatorio || {}),
        vehiculoId: v.id,
        tipo: f.tipo,
        nota: f.nota,
        proximaFecha: f.proximaFecha || null,
        proximosKm: leerKm(f.proximosKm),
        repetirMeses: leerKm(f.repetirMeses),
        repetirKm: leerKm(f.repetirKm),
      });
      cerrar();
      ui.avisar(`Recordatorio guardado: ${f.tipo === "otro" && f.nota ? f.nota : NOMBRES_RECORDATORIO[f.tipo]}`);
    } catch (e) {
      setError(e.message);
    }
  }
  async function eliminar() {
    if (!borrar) return setBorrar(true);
    try {
      await acc.borrarRecordatorio(recordatorio.id);
      cerrar();
      ui.avisar("Recordatorio eliminado", { texto: "Deshacer", fn: () => acc.guardarRecordatorio(recordatorio) });
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Hoja
      titulo={recordatorio ? nombreRecordatorio(recordatorio) : "Nuevo recordatorio"}
      subtitulo={aviso || "Te aviso en la campana cuando falten menos de 30 días o 1.000 km, lo que llegue antes."}
      onCerrar={cerrar}
      pie={
        <>
          {recordatorio && (
            <button type="button" className={`btn ${borrar ? "btn-peligro" : "btn-texto"}`} onClick={eliminar}>
              <Trash2 size={16} /> {borrar ? "¿Seguro?" : "Eliminar"}
            </button>
          )}
          <button type="button" className="btn btn-primario" onClick={guardar}>
            <BellRing size={17} /> Guardar
          </button>
        </>
      }
    >
      <div className="chips" role="group" aria-label="Tipo de recordatorio">
        {Object.entries(NOMBRES_RECORDATORIO).map(([k, t]) => (
          <button key={k} type="button" className="chip" aria-pressed={f.tipo === k} onClick={() => cambiarTipo(k)}>
            {k === "otro" ? "Otro" : k === "impuesto" ? "Impuesto" : t}
          </button>
        ))}
      </div>
      {f.tipo === "otro" && (
        <label className="campo">
          <span>Qué es</span>
          <input value={f.nota} maxLength={60} onChange={(e) => set("nota")(e.target.value)} placeholder="Ej.: cambiar las ruedas" />
        </label>
      )}
      <div className="campos-2">
        <label className="campo">
          <span>Próxima fecha</span>
          <input type="date" value={f.proximaFecha} onChange={(e) => set("proximaFecha")(e.target.value)} />
        </label>
        <label className="campo">
          <span>O a los km</span>
          <input inputMode="numeric" value={f.proximosKm} onChange={(e) => set("proximosKm")(e.target.value.replace(/\D/g, ""))} placeholder={`Ahora ${kmTxt(kmEstimados(db, v))}`} />
        </label>
      </div>
      <div className="campos-2">
        <label className="campo">
          <span>Se repite cada (meses)</span>
          <input inputMode="numeric" value={f.repetirMeses} onChange={(e) => set("repetirMeses")(e.target.value.replace(/\D/g, ""))} placeholder="No se repite" />
        </label>
        <label className="campo">
          <span>O cada (km)</span>
          <input inputMode="numeric" value={f.repetirKm} onChange={(e) => set("repetirKm")(e.target.value.replace(/\D/g, ""))} placeholder="—" />
        </label>
      </div>
      <p className="ayuda">Al apuntar un mantenimiento del mismo tipo (ITV, revisión o aceite) te propongo pasar el recordatorio a la siguiente vez.</p>
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}
