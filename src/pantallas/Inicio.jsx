import { ArrowUpRight, ArrowDownLeft, Banknote, FlaskConical, Bell, Search, ChevronDown, TrendingUp, TrendingDown, Plus, ChevronRight, Pencil } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { resumenMes, recibosMes, alertas, ahorradoObjetivo } from "../lib/calculos.js";
import { eur, nombreMes, mesCorto, saludo, mayus, MESES_CORTOS, pct } from "../lib/formato.js";
import { Cifra, Sparkline, BarraRayas, Vacio } from "../components/comunes.jsx";
import { Ficha } from "../lib/iconos.jsx";
import { ICONO } from "../config.js";
import { FilaMovimiento, ordenarMovs } from "../components/FilaMovimiento.jsx";

export default function Inicio() {
  const { db, sync } = useDatos();
  const ui = useUI();
  const r = resumenMes(db, ui.mes);
  const avisoSync = { pendiente: `${sync.pendientes} sin enviar`, offline: "sin conexión", error: "error al sincronizar" }[sync.estado];
  const recibos = recibosMes(db, ui.mes);
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

      <TarjetaSaldo r={r} mesTxt={mesTxt} />

      <div className="acciones">
        <Accion principal icono={<ArrowUpRight size={24} />} texto="Gasto" onClick={() => ui.abrir("apuntar", { tipo: "gasto" })} />
        <Accion icono={<ArrowDownLeft size={24} />} texto="Ingreso" onClick={() => ui.abrir("apuntar", { tipo: "ingreso" })} />
        <Accion icono={<Banknote size={24} />} texto="Sueldo" onClick={() => ui.abrir("sueldo", { mes: ui.mes })} />
        <Accion icono={<FlaskConical size={22} />} texto="Simular" onClick={() => ui.irA("simulador")} />
      </div>

      {recibos.length > 0 && <TarjetaRecibos recibos={recibos} mesTxt={mesTxt} />}

      <Objetivos />

      <section className="seccion">
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
  const etiqueta =
    r.fase === "pasado" ? (r.disponible >= 0 ? `Te sobró en ${mesTxt}` : `Te faltó en ${mesTxt}`) : r.fase === "futuro" ? `Disponible en ${mesTxt}` : `Te queda en ${mesTxt}`;
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
      <Cifra valor={r.disponible} className="saldo-cifra" />

      {r.sueldo == null && r.fase !== "pasado" ? (
        <button type="button" className="saldo-sin-sueldo" onClick={() => ui.abrir("sueldo", { mes: ui.mes, inicioDeMes: r.fase === "actual" })}>
          <Banknote size={16} /> Elige con qué sueldo empiezas {mesTxt}
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
        <button type="button" className="saldo-sueldo" onClick={() => ui.abrir("sueldo", { mes: ui.mes })}>
          <small>
            Sueldo{r.ingresos ? ` + ${eur(r.ingresos, { corto: true })} extra` : ""} <Pencil size={11} />
          </small>
          <b>{r.sueldo == null ? "Sin definir" : eur(r.sueldo)}</b>
        </button>
        <Sparkline valores={r.serie} />
      </div>
    </section>
  );
}

function TarjetaRecibos({ recibos, mesTxt }) {
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

function Objetivos() {
  const { db } = useDatos();
  const ui = useUI();
  if (!db.objetivos.length) {
    return (
      <button type="button" className="tarjeta objetivo-nuevo" onClick={() => ui.abrir("objetivo")}>
        <Ficha icono="hucha" color="#f6a57c" size={42} />
        <span>
          <b>Crea un objetivo de ahorro</b>
          <small>Un viaje, un colchón, un capricho… y ve apartando.</small>
        </span>
        <Plus size={20} className="tenue" />
      </button>
    );
  }
  return (
    <div className="carrusel" role="list">
      {db.objetivos.map((o) => {
        const ahorrado = ahorradoObjetivo(db, o.id);
        const p = o.meta > 0 ? (ahorrado / o.meta) * 100 : 0;
        const fecha = o.fecha ? ` · ${mayus(MESES_CORTOS[Number(o.fecha.slice(5)) - 1])} ${o.fecha.slice(0, 4)}` : "";
        return (
          <button type="button" role="listitem" key={o.id} className="tarjeta objetivo" onClick={() => ui.abrir("objetivo", { objetivo: o })}>
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
      <button type="button" className="tarjeta objetivo-mas" onClick={() => ui.abrir("objetivo")} aria-label="Nuevo objetivo de ahorro">
        <Plus size={22} />
      </button>
    </div>
  );
}
