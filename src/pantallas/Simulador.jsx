// Simulador: escenarios de "¿y si…?" con otro sueldo y otros gastos.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Plus, Copy, Trash2, Check, X, Wand2, FlaskConical, TrendingUp, TrendingDown, CalendarCheck, Sparkles } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Cifra, Anillo, CampoImporte, Vacio } from "../components/comunes.jsx";
import { Ficha, colorCategoria } from "../lib/iconos.jsx";
import { resultadoSimulacion, ordenar, ordenCategorias, esMensual, prorrateo, FRECUENCIAS } from "../lib/calculos.js";
import { eur, parseImporte, aInput, nombreMes, moverMes, mesActual, uuid, r2, pct } from "../lib/formato.js";

function sueldoDeReferencia(db) {
  const act = mesActual();
  const meses = Object.entries(db.meses).filter(([, v]) => v?.sueldo != null).sort((a, b) => b[0].localeCompare(a[0]));
  return db.meses[act]?.sueldo ?? meses[0]?.[1].sueldo ?? db.ajustes.sueldoSugerido ?? 0;
}

// El presupuesto real convertido en escenario, para comparar
function escenarioReal(db) {
  return {
    sueldo: sueldoDeReferencia(db),
    ingresosExtra: 0,
    partidas: db.partidas.filter((p) => p.activa).map((p) => ({ ...p, cobraEsteMes: false })),
    extras: [],
  };
}

export default function Simulador() {
  const { db, acc } = useDatos();
  const ui = useUI();
  const [abierto, setAbierto] = useState(null);
  const simulacion = db.simulaciones.find((s) => s.id === abierto);

  async function crear(desdePresupuesto) {
    const n = db.simulaciones.length + 1;
    const s = {
      nombre: desdePresupuesto ? `${nombreMes(moverMes(mesActual(), 1), { cap: true })} con cambios` : `Escenario ${n}`,
      sueldo: sueldoDeReferencia(db),
      ingresosExtra: 0,
      partidas: desdePresupuesto
        ? ordenar(db.partidas.filter((p) => p.activa)).map((p) => ({ ...p, id: uuid(), origenId: p.id, cobraEsteMes: false }))
        : [],
      extras: [],
      nota: "",
    };
    try {
      const r = await acc.guardarSimulacion(s);
      setAbierto(r.id);
    } catch (e) {
      ui.avisar(e.message, null, "mal");
    }
  }

  if (simulacion) return <Editor key={simulacion.id} inicial={simulacion} onVolver={() => setAbierto(null)} onAbrir={setAbierto} />;

  const real = resultadoSimulacion(escenarioReal(db));
  return (
    <div className="simulador">
      <header className="titular">
        <h1>
          <em>Simula</em> otro mes
        </h1>
      </header>
      <p className="intro">Prueba otro sueldo, quita o cambia gastos y añade gastos puntuales para ver cómo acabaría el mes. Nada de esto toca tus cuentas reales hasta que tú lo apliques.</p>

      <div className="sim-nuevo">
        <button type="button" className="tarjeta sim-crear principal" onClick={() => crear(true)}>
          <Wand2 size={22} />
          <b>Partir de mi presupuesto</b>
          <small>Copia tus {db.partidas.filter((p) => p.activa).length} partidas y cámbialas</small>
        </button>
        <button type="button" className="tarjeta sim-crear" onClick={() => crear(false)}>
          <Plus size={22} />
          <b>Empezar de cero</b>
          <small>Solo los gastos que tú añadas</small>
        </button>
      </div>

      <section className="seccion">
        <div className="seccion-cab">
          <h2>Tus escenarios</h2>
          <span className="tenue">Tu mes real: {eur(real.resultado, { signo: true, corto: true })}</span>
        </div>
        {db.simulaciones.length ? (
          <div className="lista">
            {[...db.simulaciones]
              .sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)))
              .map((s) => {
                const r = resultadoSimulacion(s);
                const dif = r2(r.resultado - real.resultado);
                return (
                  <button key={s.id} type="button" className="fila-sim" onClick={() => setAbierto(s.id)}>
                    <Anillo pct={r.usoPct} tam={52} grosor={6} peligro={r.resultado < 0}>
                      <small>{Math.round(r.usoPct)}%</small>
                    </Anillo>
                    <span className="fila-sim-txt">
                      <b>{s.nombre}</b>
                      <small>
                        Sueldo {eur(s.sueldo, { corto: true })} · {dif === 0 ? "igual que tu mes real" : `${eur(dif, { signo: true, corto: true })} frente a tu mes real`}
                      </small>
                    </span>
                    <span className={`fila-sim-res ${r.resultado < 0 ? "negativo" : "positivo"}`}>
                      {eur(r.resultado, { signo: true, corto: true })}
                      <small>{r.resultado < 0 ? "faltaría" : "sobraría"}</small>
                    </span>
                  </button>
                );
              })}
          </div>
        ) : (
          <Vacio titulo="Aún no tienes escenarios" icono={<FlaskConical size={28} />}>
            Empieza copiando tu presupuesto: así solo tienes que tocar lo que cambie.
          </Vacio>
        )}
      </section>
    </div>
  );
}

// Importe editable dentro de una fila
function ImporteFila({ valor, onCambio, etiqueta }) {
  const [txt, setTxt] = useState(aInput(valor));
  const enfocado = useRef(false);
  useEffect(() => {
    if (!enfocado.current) setTxt(aInput(valor));
  }, [valor]);
  return (
    <span className="importe-fila">
      <input
        type="text"
        inputMode="decimal"
        aria-label={etiqueta}
        value={txt}
        onFocus={(e) => {
          enfocado.current = true;
          e.target.select();
        }}
        onBlur={() => {
          enfocado.current = false;
          setTxt(aInput(valor));
        }}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d,.]/g, "");
          setTxt(t);
          const n = t === "" ? 0 : parseImporte(t);
          if (Number.isFinite(n) && n >= 0) onCambio(n);
        }}
      />
      <em>€</em>
    </span>
  );
}

function Editor({ inicial, onVolver, onAbrir }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const [s, setS] = useState(inicial);
  const [estado, setEstado] = useState("guardado");
  const [nueva, setNueva] = useState(null); // partida que se está añadiendo
  const primera = useRef(true);
  const timer = useRef(null);
  const ultimo = useRef(s);
  ultimo.current = s;

  const guardarYa = async () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    try {
      await acc.guardarSimulacion(ultimo.current);
      setEstado("guardado");
    } catch (e) {
      setEstado("error");
      ui.avisar(e.message, null, "mal");
    }
  };
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    setEstado("pendiente");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      timer.current = null;
      try {
        await acc.guardarSimulacion(ultimo.current);
        setEstado("guardado");
      } catch (e) {
        setEstado("error");
      }
    }, 600);
  }, [s, acc]);
  // Si se sale con cambios sin guardar, se guardan
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        acc.guardarSimulacion(ultimo.current).catch(() => {});
      }
    },
    [acc]
  );

  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const setPartida = (id, cambios) => setS((x) => ({ ...x, partidas: x.partidas.map((p) => (p.id === id ? { ...p, ...cambios } : p)) }));
  const quitarPartida = (id) => setS((x) => ({ ...x, partidas: x.partidas.filter((p) => p.id !== id) }));
  const setExtra = (id, cambios) => setS((x) => ({ ...x, extras: x.extras.map((e) => (e.id === id ? { ...e, ...cambios } : e)) }));

  const r = resultadoSimulacion(s);
  const real = useMemo(() => resultadoSimulacion(escenarioReal(db)), [db]);
  const dif = r2(r.resultado - real.resultado);
  const sueldoReal = sueldoDeReferencia(db);

  // Diferencias con el presupuesto real
  const cambios = useMemo(() => {
    const out = [];
    if (r2(s.sueldo) !== r2(sueldoReal)) out.push({ texto: `Sueldo ${eur(sueldoReal, { corto: true })} → ${eur(s.sueldo, { corto: true })}`, efecto: r2(s.sueldo - sueldoReal) });
    if (s.ingresosExtra) out.push({ texto: `Ingresos extra`, efecto: s.ingresosExtra });
    const usados = new Set();
    for (const p of s.partidas) {
      const o = p.origenId && db.partidas.find((x) => x.id === p.origenId);
      const coste = (x, cobra) => (esMensual(x) ? x.importe : cobra ? x.importe : prorrateo(x));
      if (o) {
        usados.add(o.id);
        const antes = o.activa ? coste(o, false) : 0;
        const ahora = p.activa ? coste(p, p.cobraEsteMes) : 0;
        if (!p.activa && o.activa) out.push({ texto: `Sin ${p.nombre}`, efecto: r2(antes) });
        else if (r2(antes) !== r2(ahora)) out.push({ texto: `${p.nombre}: ${eur(antes, { corto: true })} → ${eur(ahora, { corto: true })}${p.cobraEsteMes ? " (cae este mes)" : ""}`, efecto: r2(antes - ahora) });
      } else if (p.activa) out.push({ texto: `Nuevo: ${p.nombre}`, efecto: -r2(coste(p, p.cobraEsteMes)) });
    }
    if (s.partidas.some((p) => p.origenId)) {
      for (const o of db.partidas.filter((x) => x.activa && !usados.has(x.id))) out.push({ texto: `Sin ${o.nombre}`, efecto: r2(esMensual(o) ? o.importe : prorrateo(o)) });
    }
    if (r.puntuales) out.push({ texto: `Gastos puntuales (${s.extras.length})`, efecto: -r.puntuales });
    return out;
  }, [s, db.partidas, sueldoReal, r.puntuales]);

  async function duplicar() {
    await guardarYa();
    const copia = { ...ultimo.current, id: undefined, nombre: `${s.nombre} (copia)` };
    const nuevo = await acc.guardarSimulacion(copia);
    onAbrir(nuevo.id);
    ui.avisar("Escenario duplicado");
  }
  function eliminar() {
    ui.abrir("confirmar", {
      titulo: "¿Eliminar este escenario?",
      texto: `«${s.nombre}» desaparecerá. Tus cuentas reales no cambian.`,
      boton: "Eliminar",
      peligro: true,
      onConfirmar: async () => {
        clearTimeout(timer.current);
        timer.current = null;
        await acc.borrarSimulacion(s.id);
        onVolver();
        ui.avisar("Escenario eliminado");
      },
    });
  }
  function aplicar() {
    ui.abrir("confirmar", {
      titulo: "¿Aplicar a tu presupuesto?",
      texto: (
        <>
          <p>Tus partidas pasarán a tener los nombres, importes y frecuencias de este escenario.</p>
          <ul>
            <li>Las partidas que no estén en el escenario, o estén desactivadas, se archivan (no se borra ningún gasto).</li>
            <li>Las partidas nuevas se añaden al presupuesto.</li>
            <li>El sueldo y los gastos puntuales no se aplican: son solo de la simulación.</li>
          </ul>
        </>
      ),
      boton: "Aplicar",
      onConfirmar: async () => {
        await guardarYa();
        await acc.aplicarSimulacion(s.id);
        ui.avisar("Presupuesto actualizado con el escenario");
      },
    });
  }

  function añadirPartida() {
    if (!nueva?.nombre?.trim()) return;
    const p = {
      id: uuid(),
      origenId: null,
      nombre: nueva.nombre.trim(),
      categoria: nueva.categoria?.trim() || "Otros",
      importe: Number.isFinite(parseImporte(nueva.importe)) ? parseImporte(nueva.importe) : 0,
      frecuencia: nueva.frecuencia || "Mensual",
      recibo: false,
      icono: "paquete",
      orden: s.partidas.length ? Math.max(...s.partidas.map((x) => x.orden)) + 1 : 0,
      activa: true,
      cobraEsteMes: false,
    };
    set("partidas", [...s.partidas, p]);
    setNueva(null);
  }

  const categorias = ordenCategorias(s.partidas);
  const todasCategorias = [...new Set([...categorias, ...ordenCategorias(db.partidas)])];

  return (
    <div className="simulador editor">
      <header className="sim-cab">
        <button
          type="button"
          className="boton-redondo"
          onClick={async () => {
            await guardarYa();
            onVolver();
          }}
          aria-label="Volver a los escenarios"
        >
          <ChevronLeft size={22} />
        </button>
        <input className="sim-nombre" value={s.nombre} maxLength={60} onChange={(e) => set("nombre", e.target.value)} aria-label="Nombre del escenario" />
        <span className={`sim-estado ${estado}`}>{estado === "guardado" ? <Check size={14} /> : null}{estado === "guardado" ? "Guardado" : estado === "error" ? "Sin guardar" : "Guardando…"}</span>
      </header>

      <section className={`sim-resultado ${r.resultado < 0 ? "mal" : ""}`}>
        <div>
          <span className="saldo-etq">{r.resultado < 0 ? "Te faltaría" : "Te sobraría"}</span>
          <Cifra valor={Math.abs(r.resultado)} className="saldo-cifra" />
          <p className="comparativa">
            <span className={`pill ${dif >= 0 ? "pill-lima" : "pill-mal"}`}>
              {dif >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {eur(dif, { signo: true, corto: true })}
            </span>
            frente a tu mes real
          </p>
        </div>
        <Anillo pct={r.usoPct} tam={96} peligro={r.resultado < 0}>
          <b>{Math.round(r.usoPct)}%</b>
          <small>gastado</small>
        </Anillo>
        <dl className="sim-desglose">
          <div>
            <dt>Entra</dt>
            <dd>{eur(r.ingresos, { corto: true })}</dd>
          </div>
          <div>
            <dt>Gastos mensuales</dt>
            <dd>{eur(r.fijos, { corto: true })}</dd>
          </div>
          <div>
            <dt>Periódicos</dt>
            <dd>{eur(r.periodicos, { corto: true })}</dd>
          </div>
          <div>
            <dt>Puntuales</dt>
            <dd>{eur(r.puntuales, { corto: true })}</dd>
          </div>
        </dl>
        {r.ingresos > 0 && <p className="sim-ahorro">Ahorro: {pct(Math.max(-999, r.ahorroPct))} de lo que entra</p>}
      </section>

      <section className="seccion">
        <div className="seccion-cab">
          <h2>Ingresos</h2>
        </div>
        <div className="campos-2 tarjeta">
          <CampoImporte etiqueta="Sueldo" valor={aInput(s.sueldo)} onCambio={(t) => set("sueldo", Math.max(0, parseImporte(t) || 0))} />
          <CampoImporte etiqueta="Ingresos extra" valor={s.ingresosExtra ? aInput(s.ingresosExtra) : ""} placeholder="0" onCambio={(t) => set("ingresosExtra", Math.max(0, parseImporte(t) || 0))} />
        </div>
      </section>

      <section className="seccion">
        <div className="seccion-cab">
          <h2>Gastos del mes</h2>
          <span className="tenue">{eur(r.fijos + r.periodicos, { corto: true })}</span>
        </div>
        <p className="ayuda tenue">Desmarca lo que no pagarías, cambia importes, y marca «Cae este mes» en los pagos periódicos que tocaría pagar enteros ese mes.</p>
        {categorias.map((cat) => (
          <div key={cat} className="grupo">
            <h3 className="grupo-titulo">{cat}</h3>
            <div className="lista">
              {ordenar(s.partidas.filter((p) => p.categoria === cat)).map((p) => (
                <div key={p.id} className={`fila-simp ${p.activa ? "" : "off"}`}>
                  <label className="check">
                    <input type="checkbox" checked={p.activa} onChange={(e) => setPartida(p.id, { activa: e.target.checked })} aria-label={`Incluir ${p.nombre}`} />
                    <i aria-hidden="true">
                      <Check size={14} />
                    </i>
                  </label>
                  <Ficha icono={p.icono} color={colorCategoria(p.categoria)} size={36} />
                  <span className="fila-simp-txt">
                    <b>{p.nombre}</b>
                    <small>
                      {esMensual(p) ? (
                        "Cada mes"
                      ) : (
                        <>
                          {p.frecuencia} ·{" "}
                          <button type="button" className={`mini-chip ${p.cobraEsteMes ? "on" : ""}`} onClick={() => setPartida(p.id, { cobraEsteMes: !p.cobraEsteMes })} aria-pressed={p.cobraEsteMes}>
                            <CalendarCheck size={12} /> {p.cobraEsteMes ? "Cae este mes" : `${eur(prorrateo(p))}/mes`}
                          </button>
                        </>
                      )}
                    </small>
                  </span>
                  <ImporteFila valor={p.importe} onCambio={(n) => setPartida(p.id, { importe: n })} etiqueta={`Importe de ${p.nombre}`} />
                  {!p.origenId && (
                    <button type="button" className="boton-redondo mini" onClick={() => quitarPartida(p.id)} aria-label={`Quitar ${p.nombre}`}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {nueva ? (
          <div className="tarjeta sim-nueva">
            <label className="campo">
              <span>Nombre</span>
              <input type="text" autoFocus maxLength={60} value={nueva.nombre || ""} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Ej.: Coche nuevo" onKeyDown={(e) => e.key === "Enter" && añadirPartida()} />
            </label>
            <div className="campos-2">
              <CampoImporte etiqueta="Importe" valor={nueva.importe || ""} onCambio={(t) => setNueva({ ...nueva, importe: t })} />
              <label className="campo">
                <span>Frecuencia</span>
                <select className="select" value={nueva.frecuencia || "Mensual"} onChange={(e) => setNueva({ ...nueva, frecuencia: e.target.value })}>
                  {FRECUENCIAS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="campo">
              <span>Categoría</span>
              <input type="text" list="sim-categorias" maxLength={40} value={nueva.categoria || ""} onChange={(e) => setNueva({ ...nueva, categoria: e.target.value })} placeholder="Otros" />
              <datalist id="sim-categorias">
                {todasCategorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <div className="fila-botones">
              <button type="button" className="btn" onClick={() => setNueva(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primario" onClick={añadirPartida} disabled={!nueva.nombre?.trim()}>
                Añadir
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-linea" onClick={() => setNueva({ frecuencia: "Mensual" })}>
            <Plus size={18} /> Añadir un gasto
          </button>
        )}
      </section>

      <section className="seccion">
        <div className="seccion-cab">
          <h2>Gastos puntuales</h2>
          <span className="tenue">{eur(r.puntuales, { corto: true })}</span>
        </div>
        <p className="ayuda tenue">Cosas que solo pasarían ese mes: un viaje, una reparación, un regalo…</p>
        {s.extras.length > 0 && (
          <div className="lista">
            {s.extras.map((e) => (
              <div key={e.id} className="fila-simp">
                <Ficha icono="recibo" color="#f6a57c" size={36} />
                <input className="input-linea" value={e.concepto} maxLength={60} onChange={(ev) => setExtra(e.id, { concepto: ev.target.value })} aria-label="Concepto" placeholder="Concepto" />
                <ImporteFila valor={e.importe} onCambio={(n) => setExtra(e.id, { importe: n })} etiqueta={`Importe de ${e.concepto}`} />
                <button type="button" className="boton-redondo mini" onClick={() => set("extras", s.extras.filter((x) => x.id !== e.id))} aria-label={`Quitar ${e.concepto}`}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="btn btn-linea" onClick={() => set("extras", [...s.extras, { id: uuid(), concepto: "", importe: 0 }])}>
          <Plus size={18} /> Añadir gasto puntual
        </button>
      </section>

      {cambios.length > 0 && (
        <section className="seccion">
          <div className="seccion-cab">
            <h2>Qué cambia frente a tu mes real</h2>
          </div>
          <div className="tarjeta cambios">
            {cambios.map((c, i) => (
              <div key={i} className="cambio">
                <span>{c.texto}</span>
                <b className={c.efecto >= 0 ? "positivo" : "negativo"}>{eur(c.efecto, { signo: true, corto: true })}</b>
              </div>
            ))}
            <div className="cambio total">
              <span>Diferencia en el resultado</span>
              <b className={dif >= 0 ? "positivo" : "negativo"}>{eur(dif, { signo: true })}</b>
            </div>
          </div>
        </section>
      )}

      <section className="seccion">
        <label className="campo">
          <span>Notas</span>
          <textarea rows={3} maxLength={300} value={s.nota || ""} onChange={(e) => set("nota", e.target.value)} placeholder="Ej.: si me suben el sueldo en enero…" />
        </label>
      </section>

      <div className="sim-acciones">
        {s.partidas.length > 0 && (
          <button type="button" className="btn btn-primario" onClick={aplicar}>
            <Sparkles size={18} /> Aplicar a mi presupuesto
          </button>
        )}
        <button type="button" className="btn" onClick={duplicar}>
          <Copy size={18} /> Duplicar
        </button>
        <button type="button" className="btn btn-texto peligro" onClick={eliminar}>
          <Trash2 size={18} /> Eliminar
        </button>
      </div>
    </div>
  );
}

