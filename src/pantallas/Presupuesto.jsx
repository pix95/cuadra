import { useState } from "react";
import { Settings2, Plus, ChevronDown, Banknote, PiggyBank } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Cifra } from "../components/comunes.jsx";
import { Ficha, colorCategoria } from "../lib/iconos.jsx";
import { presupuestoMensual, ordenar, ordenCategorias, esMensual, prorrateo, previstoMes } from "../lib/calculos.js";
import { eur, nombreMes, r2, sum } from "../lib/formato.js";

export default function Presupuesto() {
  const { db } = useDatos();
  const ui = useUI();
  const [verArchivadas, setVerArchivadas] = useState(false);
  const pres = presupuestoMensual(db.partidas);
  const sueldo = db.meses[ui.mes]?.sueldo ?? null;
  const activas = db.partidas.filter((p) => p.activa);
  const archivadas = ordenar(db.partidas.filter((p) => !p.activa));
  const margen = sueldo != null ? r2(sueldo - pres.total) : null;
  const base = Math.max(sueldo ?? 0, pres.total) || 1;

  const segmentos = [
    { clave: "recibos", texto: "Recibos", valor: pres.recibos, color: "#b58cf2" },
    { clave: "variable", texto: "Gasto variable", valor: pres.variable, color: "#f27fae" },
    { clave: "periodico", texto: "Pagos periódicos", valor: pres.periodico, color: "#f6a57c" },
    ...(margen != null && margen > 0 ? [{ clave: "margen", texto: "Margen", valor: margen, color: "#c9f36b" }] : []),
  ];

  return (
    <div className="presupuesto">
      <header className="titular">
        <h1>
          <em>Tu</em> presupuesto
        </h1>
        <button type="button" className="boton-redondo" onClick={() => ui.abrir("ajustes")} aria-label="Ajustes y datos">
          <Settings2 size={20} />
        </button>
      </header>

      <section className="cuadre-tarjeta area-cuadre">
        <div className="cuadre-arriba">
          <button type="button" className="cuadre-sueldo" onClick={() => ui.abrir("sueldo", { mes: ui.mes })}>
            <small>Sueldo de {nombreMes(ui.mes)}</small>
            <b>{sueldo == null ? "Elegir sueldo" : eur(sueldo)}</b>
          </button>
          <div className="cuadre-margen">
            <small>{margen == null ? "Presupuesto al mes" : margen >= 0 ? "Margen al mes" : "Te falta al mes"}</small>
            {margen == null ? <Cifra valor={pres.total} className="cifra-l" /> : <Cifra valor={margen} signo className={`cifra-l ${margen < 0 ? "negativo" : ""}`} />}
          </div>
        </div>
        <div className="apilada" role="img" aria-label="Reparto del sueldo">
          {segmentos.map((s) => (
            <i key={s.clave} style={{ width: `${(s.valor / base) * 100}%`, background: s.color }} title={`${s.texto}: ${eur(s.valor)}`} />
          ))}
        </div>
        <ul className="leyenda">
          {segmentos.map((s) => (
            <li key={s.clave}>
              <i style={{ background: s.color }} />
              <span>{s.texto}</span>
              <b>{eur(s.valor)}</b>
            </li>
          ))}
          <li className="leyenda-total">
            <span>Presupuesto total</span>
            <b>{eur(pres.total)}</b>
          </li>
          {margen != null && sueldo > 0 && (
            <li className="leyenda-total">
              <span>Ahorro previsto</span>
              <b className={margen >= 0 ? "positivo" : "negativo"}>{Math.round((margen / sueldo) * 100)} % del sueldo</b>
            </li>
          )}
        </ul>
      </section>

      {pres.periodico > 0 && (
        <div className="nota-hucha area-nota">
          <PiggyBank size={22} />
          <p>
            Para los pagos que no son mensuales aparta <b>{eur(pres.periodico)} al mes</b> ({eur(sum(activas.filter((p) => !esMensual(p)), (p) => p.importe * { Bimestral: 6, Trimestral: 4, Semestral: 2, Anual: 1 }[p.frecuencia]), { corto: true })} al año).
          </p>
        </div>
      )}

      <div className="fila-botones area-botones">
        <button type="button" className="btn btn-primario" onClick={() => ui.abrir("partida")}>
          <Plus size={18} /> Nueva partida
        </button>
      </div>

      <div className="presupuesto-partidas">
        {ordenCategorias(activas).map((cat) => {
          const ps = ordenar(activas.filter((p) => p.categoria === cat));
          return (
            <section key={cat} className="grupo">
              <div className="grupo-cab">
                <h3 className="grupo-titulo">{cat}</h3>
                <span className="tenue">{eur(sum(ps, previstoMes))}/mes</span>
              </div>
              <div className="lista">
                {ps.map((p) => (
                  <FilaPartida key={p.id} p={p} onClick={() => ui.abrir("partida", { partida: p })} />
                ))}
              </div>
            </section>
          );
        })}

        {archivadas.length > 0 && (
          <section className="grupo">
            <button type="button" className="desplegar" aria-expanded={verArchivadas} onClick={() => setVerArchivadas(!verArchivadas)}>
              Archivadas ({archivadas.length}) <ChevronDown size={16} />
            </button>
            {verArchivadas && (
              <div className="lista archivadas">
                {archivadas.map((p) => (
                  <FilaPartida key={p.id} p={p} onClick={() => ui.abrir("partida", { partida: p })} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {sueldo == null && (
        <button type="button" className="tarjeta aviso-sueldo area-aviso" onClick={() => ui.abrir("sueldo", { mes: ui.mes })}>
          <Banknote size={20} /> Elige el sueldo de {nombreMes(ui.mes)} para ver tu margen
        </button>
      )}
    </div>
  );
}

function FilaPartida({ p, onClick }) {
  const sub = esMensual(p)
    ? [p.recibo ? "Recibo mensual" : "Cada mes"].join("")
    : `${p.frecuencia} · ${eur(prorrateo(p))}/mes`;
  return (
    <button type="button" className="fila-partida" onClick={onClick}>
      <Ficha icono={p.icono} color={colorCategoria(p.categoria)} size={42} />
      <span className="fila-partida-txt">
        <b>{p.nombre}</b>
        <small>{sub}</small>
      </span>
      <span className="fila-partida-imp">
        {eur(p.importe)}
        {!esMensual(p) && <small>por recibo</small>}
      </span>
    </button>
  );
}
