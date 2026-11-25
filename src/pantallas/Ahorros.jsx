// Ahorros: lo que tienes apartado y tus objetivos
import { Plus, ArrowDownToLine, CalendarClock } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { ahorradoObjetivo, ahorrosPrincipales, evolucionAhorro, huchaPeriodicos, primerMes, OBJETIVO_FIJO, AHORRO_PRINCIPAL } from "../lib/calculos.js";
import { eur, nombreMes, mayus, MESES, MESES_CORTOS, r2, sum, mesActual, moverMes } from "../lib/formato.js";
import { Cifra, BarraRayas, Hoja } from "../components/comunes.jsx";
import { Ficha } from "../lib/iconos.jsx";
import { GraficoBarras } from "../components/GraficoBarras.jsx";
import { PropuestaCierre } from "../components/PropuestaCierre.jsx";

export default function Ahorros() {
  const { db } = useDatos();
  const ui = useUI();
  const aportes = db.movimientos.filter((m) => m.tipo === "ahorro");
  const especiales = new Set([OBJETIVO_FIJO.id, AHORRO_PRINCIPAL.id]);
  const enObjetivos = r2(sum(aportes.filter((m) => !especiales.has(m.objetivoId)), (m) => m.importe));
  // Cuenta aparte de "Pagos no mensuales": no se suma aquí
  const total = ahorrosPrincipales(db);
  const esteMes = r2(sum(aportes.filter((m) => m.objetivoId !== OBJETIVO_FIJO.id && m.fecha.startsWith(ui.mes)), (m) => m.importe));
  const metas = r2(sum(db.objetivos, (o) => o.meta));
  const conMeta = db.objetivos.filter((o) => o.meta > 0);

  return (
    <div className="ahorros">
      <header className="titular">
        <h1>
          <em>Tus</em> ahorros
        </h1>
      </header>

      <PropuestaCierre />

      <section className="saldo ahorro-total">
        <div className="saldo-arriba">
          <span className="saldo-etq">Ahorros principales</span>
          <button type="button" className="chip-cristal boton-mas" onClick={() => ui.abrir("ahorroInicial")} aria-label="Añadir dinero a tus ahorros" title="Añadir dinero">
            <Plus size={20} />
          </button>
        </div>
        <Cifra valor={total} className="saldo-cifra" />
        <div className="saldo-pill-fila">
          <span className={`pill ${esteMes > 0 ? "pill-lima" : ""}`}>{eur(esteMes, { signo: true, corto: true })}</span>
          <span className="saldo-nota">apartado en {nombreMes(ui.mes)}</span>
        </div>
        {metas > 0 && (
          <div className="ahorro-total-pie">
            <span>
              {db.objetivos.length} {db.objetivos.length === 1 ? "objetivo" : "objetivos"} · metas {eur(metas, { corto: true })}
            </span>
            <span>{Math.min(100, Math.round((enObjetivos / metas) * 100))} % conseguido</span>
          </div>
        )}
        {conMeta.length > 0 && <BarraRayas pct={(enObjetivos / metas) * 100} />}
      </section>

      {/* Por defecto va a Ahorros principales; ahí se puede elegir otro destino */}
      <button type="button" className="btn btn-primario ahorro-apartar" onClick={() => ui.abrir("apuntar", { tipo: "ahorro", objetivoId: AHORRO_PRINCIPAL.id })}>
        <ArrowDownToLine size={18} /> Apartar dinero
      </button>

      <Evolucion />

      <section className="seccion">
        <div className="seccion-cab">
          <h2>Objetivos</h2>
        </div>
        <div className="lista-objetivos">
          <ObjetivoFijo />
          {db.objetivos.map((o) => {
            const ahorrado = ahorradoObjetivo(db, o.id);
            const p = o.meta > 0 ? (ahorrado / o.meta) * 100 : 0;
            const fecha = o.fecha ? ` · ${mayus(MESES_CORTOS[Number(o.fecha.slice(5)) - 1])} ${o.fecha.slice(0, 4)}` : "";
            return (
              <button type="button" key={o.id} className="tarjeta objetivo" onClick={() => ui.abrir("objetivo", { objetivo: o })}>
                <div className="objetivo-cab">
                  <Ficha icono={o.icono} color="#f6a57c" size={42} />
                  <span className="objetivo-txt">
                    <b>{o.nombre}</b>
                    <small>
                      {o.meta > 0 ? `${eur(ahorrado, { corto: true })} de ${eur(o.meta, { corto: true })}` : `${eur(ahorrado, { corto: true })} ahorrados`}
                      {fecha}
                    </small>
                  </span>
                  {o.meta > 0 && (
                    <span className="objetivo-pct">
                      <span>
                        <em>{Math.min(999, Math.round(p))}</em>
                        <i>%</i>
                      </span>
                      <small>ahorrado</small>
                    </span>
                  )}
                </div>
                <BarraRayas pct={p} />
              </button>
            );
          })}
          <button type="button" className="tarjeta objetivo-nuevo" onClick={() => ui.abrir("objetivo")}>
            <Ficha icono="hucha" color="#f6a57c" size={42} />
            <span>
              <b>Crea un objetivo de ahorro</b>
              <small>Un viaje, un colchón, un capricho… y ve apartando.</small>
            </span>
            <Plus size={20} className="tenue" />
          </button>
        </div>
      </section>


    </div>
  );
}

// Cuánto has apartado cada mes y qué parte del sueldo es
function Evolucion() {
  const { db } = useDatos();
  const act = mesActual();
  let n = 1;
  for (let m = primerMes(db); m < act && n < 12; m = moverMes(m, 1)) n++;
  n = Math.max(n, 6);
  const serie = evolucionAhorro(db, act, n);
  const conDatos = serie.filter((x) => x.entradas > 0 || x.ahorrado !== 0);
  const total = r2(sum(conDatos, (x) => x.ahorrado));
  const media = conDatos.length ? r2(total / conDatos.length) : 0;
  const entradas = sum(conDatos, (x) => x.entradas);
  const pctMedio = entradas > 0 ? Math.round((total / entradas) * 100) : null;
  const datos = serie.map((x) => ({
    clave: x.mes,
    valor: Math.max(0, x.ahorrado),
    futuro: false,
    titulo: `${mayus(MESES[Number(x.mes.slice(5)) - 1])}${x.pct != null ? ` · ${Math.round(x.pct)} %` : ""}`,
  }));
  return (
    <section className="tarjeta">
      <div className="tarjeta-cab">
        <h2>Ahorro de cada mes</h2>
        {media > 0 && <span className="tenue">Media {eur(media, { corto: true })}/mes</span>}
      </div>
      <p className="ayuda tenue grafico-nota">
        {total > 0
          ? `Lo que has apartado cada mes${pctMedio != null ? `: de media, el ${pctMedio} % de lo que entra` : ""}.`
          : "Aquí verás lo que apartas cada mes y qué parte de tu sueldo supone."}
      </p>
      <GraficoBarras datos={datos} media={media} alto={120} vacio="Todavía no has apartado nada" etiquetas={(d) => mayus(MESES_CORTOS[Number(d.clave.slice(5)) - 1]).slice(0, 3)} />
    </section>
  );
}

// Objetivo fijo para los pagos que no son mensuales (IBI, comunidad, agua…).
// Tú decides cada mes cuánto apartas.
function ObjetivoFijo() {
  const ui = useUI();
  const { db } = useDatos();
  const h = huchaPeriodicos(db);
  const bien = h.saldo >= 0;
  return (
    <button type="button" className="tarjeta objetivo-fijo" onClick={() => ui.abrir("hucha")}>
      <span className="cierre-icono hucha-icono">
        <CalendarClock size={20} />
      </span>
      <span className="objetivo-txt">
        <b>Pagos no mensuales</b>
        <small>Fijo · para IBI, comunidad, agua…</small>
      </span>
      <span className="objetivo-fijo-saldo">
        <b className={bien ? "" : "negativo"}>{eur(h.saldo, { corto: true })}</b>
        <small>en la hucha</small>
      </span>
    </button>
  );
}

export function HojaHucha({ cerrar }) {
  const { db } = useDatos();
  const ui = useUI();
  const h = huchaPeriodicos(db);
  return (
    <Hoja
      titulo="Pagos no mensuales"
      subtitulo="Objetivo fijo para los recibos que no llegan cada mes (IBI, comunidad, agua…). Tú decides cada mes cuánto apartas."
      onCerrar={cerrar}
      pie={
        <button
          type="button"
          className="btn btn-primario"
          onClick={() => {
            cerrar();
            ui.abrir("apuntar", { tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id });
          }}
        >
          <ArrowDownToLine size={16} /> Apartar
        </button>
      }
    >
      <dl className="cuadre">
        <dt className="total">En la hucha</dt>
        <dd className={`total ${h.saldo < 0 ? "negativo" : "positivo"}`}>{eur(h.saldo)}</dd>
      </dl>
      <p className="ayuda" style={{ marginTop: 12 }}>
        Para cubrirlos todos te tocaría apartar unos <b>{eur(h.alMes)} al mes</b>.
      </p>
    </Hoja>
  );
}
