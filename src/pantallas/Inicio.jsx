import { ArrowUpRight, ArrowDownLeft, Banknote, Bell, Search, ChevronDown, TrendingUp, TrendingDown, ChevronRight, Scale, Settings, CircleCheck, Car } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { resumenMes, recibosMes, recibosNoMensualesMes, alertas, nominaDeHoy, avisosCoche, reciboHucha, CUENTA_PRINCIPAL } from "../lib/calculos.js";
import { eur, nombreMes, mesCorto, saludo, pct, moverMes, fechaCorta } from "../lib/formato.js";
import { Cifra, Sparkline, Vacio } from "../components/comunes.jsx";
import { Ficha } from "../lib/iconos.jsx";
import { ICONO } from "../config.js";
import { PropuestaCierre } from "../components/PropuestaCierre.jsx";
import { FilaMovimiento, ordenarMovs } from "../components/FilaMovimiento.jsx";

export default function Inicio() {
  const { db, sync } = useDatos();
  const ui = useUI();
  const r = resumenMes(db, ui.mes);
  const avisoSync = { pendiente: `${sync.pendientes} sin enviar`, offline: "sin conexión", error: "error al sincronizar" }[sync.estado];
  const recibos = recibosMes(db, ui.mes);
  const recibosNM = recibosNoMensualesMes(db, ui.mes);
  const avisos = alertas(db, ui.mes);
  const nombre = db.ajustes.nombre?.trim();
  const mesTxt = nombreMes(ui.mes);

  return (
    <div className="inicio">
      <header className="cabecera">
        <button type="button" className="avatar" onClick={() => ui.abrir("ajustes")} aria-label="Ajustes">
          {nombre ? nombre.slice(0, 1).toUpperCase() : <img src={ICONO} alt="" />}
        </button>
        <div className="cabecera-txt">
          <small>
            {saludo()} 👋
            {avisoSync && (
              <button type="button" className={`sync-mini ${sync.estado}`} onClick={() => ui.abrir("ajustes")}>
                · {avisoSync}
              </button>
            )}
          </small>
          <b>{nombre || "Tus cuentas"}</b>
        </div>
        <button type="button" className="boton-redondo" onClick={() => ui.irA("movimientos", { buscar: true })} aria-label="Buscar movimientos">
          <Search size={20} />
        </button>
        <button type="button" className="boton-redondo" onClick={() => ui.abrir("alertas")} aria-label={`Avisos (${avisos.length})`}>
          <Bell size={20} />
          {avisos.some((a) => a.nivel !== "info") ? <i className="punto mal" /> : avisos.length ? <i className="punto" /> : null}
        </button>
      </header>

      <div className="inicio-cols">
        <div className="col-a">
          <div className="acciones">
            <Accion principal icono={<ArrowUpRight size={24} />} texto="Gasto" onClick={() => ui.abrir("apuntar", { tipo: "gasto" })} />
            <Accion icono={<ArrowDownLeft size={24} />} texto="Ingreso" onClick={() => ui.abrir("apuntar", { tipo: "ingreso" })} />
            <Accion icono={<Banknote size={24} />} texto="Nómina" onClick={() => ui.abrir("nomina")} />
          </div>

          <TarjetaSaldo r={r} mesTxt={mesTxt} />

          <PropuestaCierre />

          {recibos.length + recibosNM.length > 0 && <TarjetaRecibos recibos={recibos} noMensuales={recibosNM} hucha={reciboHucha(db, ui.mes)} mesTxt={mesTxt} />}

          <TarjetaCoche db={db} />
        </div>

        <section className="seccion col-b">
          <div className="seccion-cab">
            <h2>Actividad reciente</h2>
            <button type="button" className="enlace" onClick={() => ui.irA("movimientos")}>
              Ver todo
            </button>
          </div>
          {r.movs.length ? (
            <div className="lista">
              {ordenarMovs(r.movs)
                .slice(0, 6)
                .map((m) => (
                  <FilaMovimiento key={m.id} m={m} db={db} onClick={() => ui.abrir("apuntar", { movimiento: m })} />
                ))}
            </div>
          ) : (
            <Vacio titulo={`Nada apuntado en ${mesTxt}`}>Pulsa «Gasto» para apuntar el primero.</Vacio>
          )}
        </section>
      </div>
    </div>
  );
}

function Accion({ icono, texto, onClick, principal }) {
  return (
    <button type="button" className={`accion ${principal ? "principal" : ""}`} onClick={onClick}>
      <span>{icono}</span>
      {texto}
    </button>
  );
}

function TarjetaSaldo({ r, mesTxt }) {
  const ui = useUI();
  const { db } = useDatos();
  // La cifra grande es el saldo de la cuenta principal (con lo que arrastra de
  // meses anteriores); el desglose dice cuánto es de este mes.
  const etiqueta = r.fase === "pasado" ? `En tu cuenta al cerrar ${mesTxt}` : r.fase === "futuro" ? `En tu cuenta en ${mesTxt}` : "En tu cuenta";
  const desglose = [
    `${r.fase === "pasado" ? "Ese mes" : "Este mes"} ${eur(r.disponible, { signo: true, corto: true })}`,
    r.arrastre ? `arrastras de ${nombreMes(moverMes(r.mes, -1))} ${eur(r.arrastre, { corto: true })}` : null,
    r.ajustesMes ? `ajustes ${eur(r.ajustesMes, { signo: true, corto: true })}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const positivo = r.fase === "pasado" ? r.disponible >= 0 : r.prevision >= 0;
  const real = r.entradas > 0 ? (r.disponible / r.entradas) * 100 : 0;

  return (
    <section className="saldo">
      <div className="saldo-arriba">
        <span className="saldo-etq">{etiqueta}</span>
        <button type="button" className="chip-cristal" onClick={() => ui.abrir("meses")}>
          {mesCorto(ui.mes, { año: true })} <ChevronDown size={15} />
        </button>
      </div>
      <Cifra valor={r.saldoCuenta} className="saldo-cifra" />
      <p className="saldo-desglose">
        {desglose}
        {r.fase !== "futuro" && (
          <button type="button" className="saldo-cuadrar" onClick={() => ui.abrir("cuadrar", { cuenta: CUENTA_PRINCIPAL.id })}>
            <Scale size={12} /> Cuadrar con el banco
          </button>
        )}
      </p>

      {r.sueldo == null && r.fase !== "pasado" ? (
        <button type="button" className="saldo-sin-sueldo" onClick={() => ui.abrir("nomina", { mes: ui.mes })}>
          <Banknote size={16} /> Aún no has ingresado la nómina de {mesTxt}
        </button>
      ) : (
        <div className="saldo-pill-fila">
          <span className={`pill ${positivo ? "pill-lima" : "pill-mal"}`}>
            {positivo ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {r.fase === "pasado" ? pct(real) : eur(r.prevision, { signo: true, corto: true })}
          </span>
          <span className="saldo-nota">{r.fase === "pasado" ? "de lo que entró" : r.fase === "futuro" ? "si sigues el presupuesto" : "previsión a fin de mes"}</span>
        </div>
      )}

      <div className="saldo-abajo">
        <div className="nomina-bloque">
          {r.sueldo != null && (
            <small className="nomina-mes">
              Nómina de {mesTxt}: {eur(r.sueldo, { corto: true })}
              {r.ingresos ? ` + ${eur(r.ingresos, { corto: true })} extra` : ""}
            </small>
          )}
          <BotonNomina db={db} />
        </div>
        <Sparkline valores={r.serie} />
      </div>
    </section>
  );
}

// «Ingresar nómina» con el engranaje de la configuración. Siempre va a la
// nómina que toca: siempre la del mes siguiente.
function BotonNomina({ db }) {
  const ui = useUI();
  const n = nominaDeHoy(db);
  const hecha = Boolean(n.ingresada);
  return (
    <div className={`boton-nomina ${hecha ? "hecha" : ""}`}>
      <button type="button" className="boton-nomina-principal" onClick={() => ui.abrir("nomina", hecha ? { mes: n.mes } : {})}>
        {hecha ? <CircleCheck size={19} /> : <Banknote size={19} />}
        <span>
          <b>{hecha ? "Nómina ingresada" : "Ingresar nómina"}</b>
          <small>{hecha ? `${nombreMes(n.mes)} · ${fechaCorta(n.ingresada)}` : `de ${nombreMes(n.mes)}`}</small>
        </span>
      </button>
      <button type="button" className="boton-nomina-ajustes" onClick={() => ui.abrir("nominaAjustes")} aria-label="Configurar la nómina" title="Configurar la nómina">
        <Settings size={18} />
      </button>
    </div>
  );
}

// Solo cuando el coche tiene algo pendiente (ITV, revisión, consumo alto…)
function TarjetaCoche({ db }) {
  const ui = useUI();
  const avisos = avisosCoche(db);
  if (!avisos.length) return null;
  const a = avisos[0];
  return (
    <button type="button" className={`tarjeta coche-inicio nivel-${a.nivel}`} onClick={() => ui.irA("coche")}>
      <span className="coche-inicio-icono">
        <Car size={20} />
      </span>
      <span className="recibos-txt">
        <b>{a.recordatorio ? a.recordatorio.texto[0].toUpperCase() + a.recordatorio.texto.slice(1) : "Consumo alto"}</b>
        <small>
          {a.vehiculo.nombre}
          {avisos.length > 1 ? ` · y ${avisos.length - 1} aviso${avisos.length > 2 ? "s" : ""} más` : ""}
        </small>
      </span>
      <ChevronRight size={18} className="tenue" />
    </button>
  );
}

function TarjetaRecibos({ recibos: mensuales, noMensuales = [], hucha = null, mesTxt }) {
  // Apartar a la hucha cuenta como un recibo más
  const filaHucha = hucha ? [{ partida: { id: "hucha", nombre: "Apartar a la hucha", importe: hucha.falta }, hecho: hucha.hecho }] : [];
  const recibos = [...mensuales, ...filaHucha, ...noMensuales];
  const ui = useUI();
  const hechos = recibos.filter((x) => x.hecho).length;
  const faltan = recibos.filter((x) => !x.hecho).reduce((s, x) => s + x.partida.importe, 0);
  return (
    <button type="button" className="tarjeta recibos" onClick={() => ui.abrir("recibos", { mes: ui.mes })}>
      <div className="recibos-cab">
        <Ficha icono="recibo" color="#c9f36b" size={42} />
        <span className="recibos-txt">
          <b>Recibos de {mesTxt}</b>
          <small>{faltan > 0 ? `Faltan ${eur(faltan)} por cargar` : "Todos cargados"}</small>
        </span>
        <span className="recibos-n">
          <em>{hechos}</em>/{recibos.length}
        </span>
        <ChevronRight size={18} className="tenue" />
      </div>
      <div className="recibos-puntos" aria-hidden="true">
        {recibos.map((x) => (
          <i key={x.partida.id} className={x.hecho ? "hecho" : ""} title={x.partida.nombre} />
        ))}
      </div>
    </button>
  );
}
