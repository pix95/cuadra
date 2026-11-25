// Ahorros: lo que tienes apartado y tus objetivos
import { Plus, PiggyBank, ArrowDownToLine } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { ahorradoObjetivo } from "../lib/calculos.js";
import { eur, nombreMes, mayus, MESES_CORTOS, r2, sum } from "../lib/formato.js";
import { Cifra, BarraRayas } from "../components/comunes.jsx";
import { Ficha } from "../lib/iconos.jsx";

export default function Ahorros() {
  const { db } = useDatos();
  const ui = useUI();
  const aportes = db.movimientos.filter((m) => m.tipo === "ahorro");
  const total = r2(sum(aportes, (m) => m.importe));
  const esteMes = r2(sum(aportes.filter((m) => m.fecha.startsWith(ui.mes)), (m) => m.importe));
  const metas = r2(sum(db.objetivos, (o) => o.meta));
  const conMeta = db.objetivos.filter((o) => o.meta > 0);

  return (
    <div className="ahorros">
      <header className="titular">
        <h1>
          <em>Tus</em> ahorros
        </h1>
        <button type="button" className="boton-redondo" onClick={() => ui.abrir("objetivo")} aria-label="Nuevo objetivo de ahorro">
          <Plus size={22} />
        </button>
      </header>

      <section className="saldo ahorro-total">
        <div className="saldo-arriba">
          <span className="saldo-etq">Total ahorrado</span>
          <PiggyBank size={22} />
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
            <span>{Math.min(100, Math.round((total / metas) * 100))} % conseguido</span>
          </div>
        )}
        {conMeta.length > 0 && <BarraRayas pct={(total / metas) * 100} />}
      </section>

      {db.objetivos.length > 0 && (
        <button type="button" className="btn btn-primario ahorro-apartar" onClick={() => ui.abrir("apuntar", { tipo: "ahorro" })}>
          <ArrowDownToLine size={18} /> Apartar dinero
        </button>
      )}

      <section className="seccion">
        <div className="seccion-cab">
          <h2>Objetivos</h2>
        </div>
        <div className="lista-objetivos">
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
