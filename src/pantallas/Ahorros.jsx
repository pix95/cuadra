// Ahorros: lo que tienes apartado y tus objetivos
import { Plus, ArrowDownToLine, CalendarClock, Scale, TrendingUp, TrendingDown, Check } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { ahorradoObjetivo, ahorrosPrincipales, resumenCuentas, resumenMes, evolucionAhorro, huchaPeriodicos, primerMes, mesDe, mesEnCurso, OBJETIVO_FIJO, AHORRO_PRINCIPAL } from "../lib/calculos.js";
import { eur, nombreMes, mayus, MESES, MESES_CORTOS, r2, sum, moverMes, mesCorto } from "../lib/formato.js";
import { Cifra, BarraRayas, Hoja } from "../components/comunes.jsx";
import { Ficha } from "../lib/iconos.jsx";
import { GraficoBarras } from "../components/GraficoBarras.jsx";
import { PropuestaCierre } from "../components/PropuestaCierre.jsx";

export default function Ahorros() {
  const { db } = useDatos();
  const ui = useUI();
  // Cada cuenta va por separado: aquí solo Ahorros principales
  const total = ahorrosPrincipales(db);
  const esteMes = r2(sum(db.movimientos.filter((m) => m.tipo === "ahorro" && m.objetivoId === AHORRO_PRINCIPAL.id && mesDe(m) === ui.mes), (m) => m.importe));
  const cuentas = resumenCuentas(db);
  const cuenta = resumenMes(db, mesEnCurso(db));

  return (
    <div className="ahorros">
      <header className="titular">
        <h1>
          <em>Tus</em> ahorros
        </h1>
      </header>

      <PropuestaCierre />

      <section className="saldo ahorro-total area-principal">
        <div className="saldo-arriba">
          <span className="saldo-etq">Ahorros principales</span>
          <button
            type="button"
            className="chip-cristal boton-mas"
            // Sale de lo que te queda del mes, como cualquier ahorro
            onClick={() => ui.abrir("apuntar", { tipo: "ahorro", objetivoId: AHORRO_PRINCIPAL.id })}
            aria-label="Apartar a Ahorros principales"
            title="Apartar a Ahorros principales"
          >
            <Plus size={20} />
          </button>
        </div>
        <Cifra valor={total} className="saldo-cifra" />
        <div className="saldo-pill-fila">
          <span className={`pill ${esteMes > 0 ? "pill-lima" : ""}`}>{eur(esteMes, { signo: true, corto: true })}</span>
          <span className="saldo-nota">apartado en {nombreMes(ui.mes)}</span>
        </div>
        <button type="button" className="saldo-cuadrar ahorro-cuadrar" onClick={() => ui.abrir("cuadrar", { cuenta: AHORRO_PRINCIPAL.id })}>
          <Scale size={12} /> Cuadrar con el banco
        </button>
      </section>

      {/* Por defecto va a Ahorros principales; ahí se puede elegir otro destino */}
      <button type="button" className="btn btn-primario ahorro-apartar area-mover" onClick={() => ui.abrir("apuntar", { tipo: "ahorro", objetivoId: AHORRO_PRINCIPAL.id })}>
        <ArrowDownToLine size={18} /> Mover ahorros
      </button>

      <section className="seccion area-objetivos">
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
              <button type="button" key={o.id} className="tarjeta objetivo fondo-degradado" onClick={() => ui.abrir("objetivo", { objetivo: o })}>
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

      <div className="tarjeta entre-cuentas area-entre">
        <div className="entre-cuentas-cab">
          <span>Entre todos tus ahorros</span>
          <b>{eur(cuentas.total)}</b>
        </div>
        <small>
          Principales {eur(cuentas.principales, { corto: true })} · Recibos no mensuales {eur(cuentas.noMensuales, { corto: true })} · Objetivos {eur(cuentas.objetivos, { corto: true })}
        </small>
      </div>

      {/* Ahorros + lo que hay en la cuenta principal */}
      <div className="tarjeta entre-cuentas todo-tu-dinero area-todo">
        <div className="entre-cuentas-cab">
          <span>Todo tu dinero</span>
          <b>{eur(cuentas.total + cuenta.saldoCuenta)}</b>
        </div>
        <small>
          Ahorros {eur(cuentas.total, { corto: true })} · Cuenta principal {eur(cuenta.saldoCuenta, { corto: true })}
        </small>
      </div>

      <Evolucion />
    </div>
  );
}

// Cuánto has apartado cada mes y qué parte del sueldo es
function Evolucion() {
  const { db } = useDatos();
  const act = mesEnCurso(db);
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
    <section className="tarjeta area-evol">
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

// Indicador de la hucha: al día, adelantado o por detrás
function EstadoHucha({ estado }) {
  if (Math.abs(estado) < 1) return <span className="estado-hucha al-dia">Al día</span>;
  return estado > 0 ? (
    <span className="estado-hucha adelantado">
      <TrendingUp size={13} /> Vas {eur(estado, { corto: true })} adelantado
    </span>
  ) : (
    <span className="estado-hucha detras">
      <TrendingDown size={13} /> Vas {eur(-estado, { corto: true })} por detrás
    </span>
  );
}

// Objetivo fijo para los recibos que no son mensuales (IBI, comunidad, agua…).
// Tú decides cada mes cuánto apartas; al pagar uno de esos recibos sale de aquí.
function ObjetivoFijo() {
  const ui = useUI();
  const { db } = useDatos();
  const mes = mesEnCurso(db);
  const h = huchaPeriodicos(db, mes);
  const falta = r2(Math.max(0, h.sugerida - h.apartadoMes));
  return (
    <button type="button" className="tarjeta objetivo-fijo fondo-degradado" onClick={() => ui.abrir("hucha")}>
      <div className="objetivo-fijo-fila">
        <span className="cierre-icono hucha-icono">
          <CalendarClock size={20} />
        </span>
        <span className="objetivo-txt">
          <b>Recibos no mensuales</b>
          <small>
            {falta > 0 ? `En ${nombreMes(mes)} aparta ${eur(falta, { corto: true })}` : h.sugerida > 0 ? `${mayus(nombreMes(mes))} ya está apartado` : "Fijo · para IBI, comunidad, agua…"}
          </small>
        </span>
        <span className="objetivo-fijo-saldo">
          <b className={h.saldo < 0 ? "negativo" : ""}>{eur(h.saldo, { corto: true })}</b>
          <small>en la hucha</small>
        </span>
      </div>
      {(h.cobros.length > 0 || h.sugerida > 0) && (
        <div className="objetivo-fijo-pie">
          <EstadoHucha estado={h.estado} />
          {h.proximo && (
            <span>
              Próximo: {h.proximo.partida.nombre} · {mesCorto(h.proximo.mes).toLowerCase()} · {eur(h.proximo.importe, { corto: true })}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export function HojaHucha({ cerrar }) {
  const { db } = useDatos();
  const ui = useUI();
  // La hucha va con el mes en curso (diciembre en cuanto entra su nómina)
  const mes = mesEnCurso(db);
  const h = huchaPeriodicos(db, mes);
  const falta = r2(Math.max(0, h.sugerida - h.apartadoMes));
  // El mes siguiente, con lo que hay ahora (si este mes apartas más, baja)
  const sig = moverMes(mes, 1);
  const hSig = huchaPeriodicos(db, sig);
  const Mes = mayus(nombreMes(mes));
  // «Piensa que…»: los cobros de los próximos meses, agrupados por mes
  const proximos = [];
  for (const c of hSig.cobros.filter((c) => c.k < 4)) {
    const g = proximos.find((x) => x.mes === c.mes);
    if (g) g.cobros.push(c);
    else proximos.push({ mes: c.mes, cobros: [c] });
  }
  const yLista = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}`);
  const explicacion =
    Math.abs(h.estado) < 1
      ? `Con lo que hay y la cuota de cada mes (${eur(h.prorrateo, { corto: true })}), llegas justo a todos los recibos de los próximos 12 meses.`
      : h.estado > 0
        ? `Tienes ${eur(h.estado, { corto: true })} más de lo necesario para llegar a todos los recibos de los próximos 12 meses.`
        : `Te faltan ${eur(-h.estado, { corto: true })} para llegar a todos los recibos de los próximos 12 meses con la cuota de cada mes (${eur(h.prorrateo, { corto: true })}).`;
  return (
    <Hoja
      titulo="Recibos no mensuales"
      subtitulo="Hucha para los recibos que no llegan cada mes (IBI, comunidad, agua…). Tú decides cuánto apartas; al pagar uno de esos recibos, el dinero sale de aquí."
      onCerrar={cerrar}
      pie={
        <>
          <button
            type="button"
            className="btn btn-texto"
            onClick={() => {
              cerrar();
              ui.abrir("cuadrar", { cuenta: OBJETIVO_FIJO.id });
            }}
          >
            <Scale size={16} /> Cuadrar
          </button>
          <button
            type="button"
            className="btn btn-primario"
            onClick={() => {
              cerrar();
              ui.abrir("apuntar", { tipo: "ahorro", objetivoId: OBJETIVO_FIJO.id, importe: falta || undefined, mes });
            }}
          >
            <ArrowDownToLine size={16} /> Apartar{falta > 0 ? ` ${eur(falta, { corto: true })}` : ""}
          </button>
        </>
      }
    >
      <dl className="cuadre">
        <dt className="total">En la hucha</dt>
        <dd className={`total ${h.saldo < 0 ? "negativo" : "positivo"}`}>{eur(h.saldo)}</dd>
        <dt>Tocaba apartar en {nombreMes(mes)}</dt>
        <dd>{eur(h.sugerida)}</dd>
        <dt>Has apartado en {nombreMes(mes)}</dt>
        <dd className={falta > 0 ? "" : "positivo"}>
          {falta > 0 ? "" : <Check size={14} />} {eur(h.apartadoMes)}
        </dd>
      </dl>
      <p className={`aviso-linea ${falta > 0 ? "" : "ok"}`}>
        {falta > 0
          ? `Te faltan ${eur(falta)} por apartar en ${nombreMes(mes)}.`
          : h.sugerida > 0
            ? `${Mes} cumplido: no tienes que apartar nada más${h.apartadoMes - h.sugerida >= 1 ? ` (has puesto ${eur(r2(h.apartadoMes - h.sugerida))} de más)` : ""}.`
            : `En ${nombreMes(mes)} no hace falta apartar nada.`}
        {hSig.sugerida > 0 ? ` En ${nombreMes(sig)} tendrás que apartar ${eur(hSig.sugerida)}.` : ` En ${nombreMes(sig)} no hará falta apartar nada.`}
      </p>
      {hSig.sugerida > 0 && (proximos.length > 0 || hSig.sinFecha > 0) && (
        <div className="piensa-que">
          <b>Piensa que…</b>
          <ul>
            {proximos.map((g) => (
              <li key={g.mes}>
                En {nombreMes(g.mes)} {g.cobros.length > 1 ? "tocan" : "toca"} {yLista(g.cobros.map((c) => `${c.partida.nombre} (${eur(c.importe, { corto: true })})`))}.
              </li>
            ))}
            {hSig.sinFecha > 0 && <li>Y cada mes {eur(hSig.sinFecha, { corto: true })} para los recibos sin fecha de cobro.</li>}
          </ul>
        </div>
      )}
      <div className="hucha-estado-fila">
        <EstadoHucha estado={h.estado} />
        <p className="ayuda">{explicacion}</p>
      </div>
      {h.proximo && (
        <p className={`aviso-linea ${h.proximo.cubierto ? "ok" : ""}`}>
          Próximo cobro: {h.proximo.partida.nombre}, {eur(h.proximo.importe)} en {nombreMes(h.proximo.mes, { año: true })}.{" "}
          {h.proximo.cubierto ? "La hucha llega." : `Si solo apartas lo normal, la hucha no llega: aparta lo que te toca en ${nombreMes(mes)}.`}
        </p>
      )}
      {h.cobros.length > 0 ? (
        <>
          <h3 className="hoja-sub-titulo">
            <CalendarClock size={16} /> Próximos 12 meses
          </h3>
          <div className="lista">
            {h.cobros.map((c) => (
              <div key={`${c.mes}-${c.partida.id}`} className="cobro">
                <span className="cobro-mes">{mesCorto(c.mes, { año: true })}</span>
                <span className="cobro-nombre">{c.partida.nombre}</span>
                <b>{eur(c.importe)}</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="ayuda" style={{ marginTop: 12 }}>
          Ningún recibo no mensual tiene fecha de cobro. Ponla en Presupuesto («Próximo cobro») para que la hucha sepa cuándo tiene que tenerlo.
        </p>
      )}
      {h.sinFecha > 0 && (
        <p className="ayuda tenue" style={{ marginTop: 10 }}>
          Los recibos sin fecha suman {eur(h.sinFecha)} al mes a la sugerencia (su parte proporcional).
        </p>
      )}
    </Hoja>
  );
}
