// La nómina: «Ingresar nómina» (con el mes al que cuenta) y su configuración.
import { useState } from "react";
import { Banknote, Settings, Check } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Hoja, CampoImporte, Segmentado, Interruptor } from "../components/comunes.jsx";
import { configNomina, mesDeNomina, importeNomina, presupuestoMensual } from "../lib/calculos.js";
import { eur, parseImporte, aInput, nombreMes, moverMes, hoyISO, fechaCorta, MESES_CORTOS, mayus, r2 } from "../lib/formato.js";

// ---------- Ingresar la nómina ----------
// mes: fuerza el mes (al tocar un mes concreto); si no, se deduce de la fecha.
export function HojaNomina({ mes: mesFijo = null, inicioDeMes = false, cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const cfg = configNomina(db);
  const [fecha, setFecha] = useState(() => {
    // Si el mes es otro, la fecha propuesta cae dentro de él
    const hoy = hoyISO();
    return mesFijo && mesDeNomina(hoy) !== mesFijo && hoy.slice(0, 7) !== mesFijo ? `${mesFijo}-01` : hoy;
  });
  const [mesElegido, setMesElegido] = useState(mesFijo);
  const [aMano, setAMano] = useState(false);
  const mesAuto = mesDeNomina(fecha || hoyISO());
  const mes = mesElegido ?? mesAuto;
  const previa = db.meses[mes] || null;
  const propuesto = importeNomina(db, mes);
  const [txt, setTxt] = useState(null); // null = lo propuesto (cambia con el mes)
  const [error, setError] = useState("");
  const valorTxt = txt ?? aInput(previa?.sueldo ?? propuesto.total ?? "");
  const v = parseImporte(valorTxt);
  const pres = presupuestoMensual(db.partidas);
  const margen = Number.isFinite(v) ? r2(v - pres.total) : null;
  // Las dos opciones: el mes de la fecha y el siguiente
  const mesFecha = (fecha || hoyISO()).slice(0, 7);
  const opciones = [mesFecha, moverMes(mesFecha, 1)];
  if (!opciones.includes(mes)) opciones.unshift(mes);

  async function guardar() {
    if (!Number.isFinite(v) || v < 0) return setError("Escribe la nómina como un número, por ejemplo 1500 o 1.500,50.");
    if (!fecha) return setError("Elige el día en que te llegó.");
    try {
      await acc.ponerSueldo(mes, v, { ingresada: fecha });
      cerrar();
      ui.avisar(`Nómina de ${nombreMes(mes)} ingresada: ${eur(v, { corto: true })}`, {
        texto: "Deshacer",
        fn: () => acc.ponerSueldo(mes, previa?.sueldo ?? null, { ingresada: previa?.ingresada ?? null }),
      });
    } catch (e) {
      setError(e.message);
    }
  }
  async function quitar() {
    await acc.ponerSueldo(mes, null);
    cerrar();
    ui.avisar(`Nómina de ${nombreMes(mes)} quitada`, { texto: "Deshacer", fn: () => acc.ponerSueldo(mes, previa.sueldo, { ingresada: previa.ingresada ?? null }) });
  }
  function posponer() {
    try {
      sessionStorage.setItem(`cuadra:sueldo-pospuesto:${mes}`, "1");
    } catch {
      /* nada */
    }
    cerrar();
  }

  const empezando = inicioDeMes && !previa;
  return (
    <Hoja
      titulo={empezando ? `Empieza ${nombreMes(mes)}` : previa?.ingresada ? `Nómina de ${nombreMes(mes, { año: true })}` : "Ingresar nómina"}
      subtitulo={
        empezando
          ? "¿Ya te ha llegado la nómina? Ingrésala para empezar el mes. Puedes cambiarla cuando quieras."
          : "Lo que entra en tu cuenta. Cuenta para el mes siguiente: la que cobras a final de noviembre es la de diciembre."
      }
      onCerrar={empezando ? posponer : cerrar}
      pie={
        <>
          {empezando ? (
            <button type="button" className="btn" onClick={posponer}>
              Ahora no
            </button>
          ) : previa ? (
            <button type="button" className="btn btn-texto" onClick={quitar}>
              Quitar
            </button>
          ) : null}
          <button type="button" className="btn btn-primario" onClick={guardar}>
            <Banknote size={17} /> {previa ? "Guardar" : "Ingresar"}
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
        <CampoImporte grande autoFocus etiqueta="Nómina neta" valor={valorTxt} onCambio={setTxt} placeholder="0,00" />
      </form>
      {propuesto.extra > 0 && !previa && (
        <p className="aviso-linea ok">
          Incluye la paga extra de {nombreMes(mes)}: {eur(propuesto.base ?? 0, { corto: true })} + {eur(propuesto.extra, { corto: true })}
        </p>
      )}
      <label className="campo">
        <span>Día en que te llegó</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>
      <div className="campo">
        <span>Es la nómina de</span>
        <Segmentado
          peq
          etiqueta="Mes de la nómina"
          opciones={opciones.map((m) => ({ valor: m, texto: mayus(nombreMes(m)) }))}
          valor={mes}
          onCambio={(m) => {
            setMesElegido(m === mesAuto ? null : m);
            setAMano(m !== mesAuto);
            setTxt(null);
          }}
        />
        <small className="ayuda">
          {aMano
            ? `La has elegido a mano para ${nombreMes(mes)}.`
            : `Cuenta para ${nombreMes(mes)}.${mes === mesAuto ? " Si es la de este mes porque llegó tarde, elige el otro." : ""}`}
          {previa?.ingresada && ` Ya la ingresaste el ${fechaCorta(previa.ingresada)}.`}
        </small>
      </div>
      <dl className="cuadre">
        <dt>Presupuesto mensual</dt>
        <dd>{eur(pres.total)}</dd>
        {margen != null && (
          <>
            <dt className="total">Margen con esta nómina</dt>
            <dd className={`total ${margen < 0 ? "negativo" : "positivo"}`}>{eur(margen, { signo: true })}</dd>
          </>
        )}
      </dl>
      {!empezando && (
        <button type="button" className="enlace nomina-config-enlace" onClick={() => ui.abrir("nominaAjustes")}>
          <Settings size={14} /> Configurar la nómina
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}

// ---------- Configurar la nómina ----------
export function HojaConfigNomina({ cerrar }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const cfg = configNomina(db);
  const [importe, setImporte] = useState(aInput(cfg.importe ?? ""));
  const [dia, setDia] = useState(cfg.diaCorte);
  const [conExtras, setConExtras] = useState(cfg.pagasExtra.meses.length > 0);
  const [mesesExtra, setMesesExtra] = useState(cfg.pagasExtra.meses.length ? cfg.pagasExtra.meses : [6, 12]);
  const [extra, setExtra] = useState(aInput(cfg.pagasExtra.importe || ""));
  const [error, setError] = useState("");

  async function guardar() {
    const imp = importe.trim() === "" ? null : parseImporte(importe);
    if (imp != null && (!Number.isFinite(imp) || imp < 0)) return setError("El importe de la nómina no es válido.");
    const ext = extra.trim() === "" ? 0 : parseImporte(extra);
    if (conExtras && (!Number.isFinite(ext) || ext < 0)) return setError("El importe de la paga extra no es válido.");
    if (conExtras && !mesesExtra.length) return setError("Elige en qué nóminas va la paga extra.");
    try {
      await acc.guardarAjustes({
        nomina: { importe: imp, diaCorte: Number(dia), pagasExtra: conExtras ? { meses: mesesExtra, importe: ext } : { meses: [], importe: 0 } },
      });
      cerrar();
      ui.avisar("Nómina configurada");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Hoja
      titulo="Tu nómina"
      subtitulo="Lo que se propone al pulsar «Ingresar nómina» y a qué mes cuenta."
      onCerrar={cerrar}
      pie={
        <button type="button" className="btn btn-primario" onClick={guardar}>
          <Check size={17} /> Guardar
        </button>
      }
    >
      <CampoImporte etiqueta="Nómina neta habitual" valor={importe} onCambio={setImporte} placeholder="Ej.: 1.500" />
      <label className="campo">
        <span>Recordarme la nómina a partir del día</span>
        <select className="select" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <small className="ayuda">
          Desde ese día, la campana te recuerda ingresar la nómina del mes siguiente. La nómina siempre cuenta para el mes siguiente al día en que te llega.
        </small>
      </label>
      <Interruptor activo={conExtras} onCambio={setConExtras} etiqueta="Pagas extra" descripcion="Se suman a la nómina de los meses que elijas" />
      {conExtras && (
        <>
          <div className="chips meses-chips" role="group" aria-label="Meses con paga extra">
            {MESES_CORTOS.map((m, i) => {
              const n = i + 1;
              const on = mesesExtra.includes(n);
              return (
                <button key={m} type="button" className="chip" aria-pressed={on} onClick={() => setMesesExtra((xs) => (on ? xs.filter((x) => x !== n) : [...xs, n].sort((a, b) => a - b)))}>
                  {m}
                </button>
              );
            })}
          </div>
          <CampoImporte etiqueta="Importe de cada paga extra" valor={extra} onCambio={setExtra} placeholder="0" />
        </>
      )}
      <button
        type="button"
        className="enlace nomina-config-enlace"
        onClick={() => {
          cerrar();
          ui.abrir("sueldo", { mes: ui.mes });
        }}
      >
        Cambiar a mano la nómina de {nombreMes(ui.mes)}
      </button>
      {error && <p className="error">{error}</p>}
    </Hoja>
  );
}
