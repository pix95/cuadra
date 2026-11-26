import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Segmentado, Cifra, Anillo, Barra, Vacio } from "../components/comunes.jsx";
import { GraficoBarras } from "../components/GraficoBarras.jsx";
import { Ficha, colorCategoria, iconoCategoria } from "../lib/iconos.jsx";
import {
  analisisPeriodo, mesEnCurso, moverPeriodo, resumenMes, acumuladoAño, ordenar, esMensual, estadoDe, porcentaje, anual, ordenCategorias,
} from "../lib/calculos.js";
import { eur, pct1, nombreMes, MESES, MESES_CORTOS, DIAS_CORTOS, fechaCorta, hoyISO, mayus, r2, diasEnMes } from "../lib/formato.js";

export default function Analisis() {
  const { db } = useDatos();
  const ui = useUI();
  const [tipo, setTipo] = useState("mes");
  const [anclaSem, setAnclaSem] = useState(hoyISO());
  const [verTodas, setVerTodas] = useState(false);

  const ancla = tipo === "semana" ? anclaSem : `${ui.mes}-01`;
  const a = analisisPeriodo(db, tipo, ancla);

  function mover(d) {
    if (tipo === "semana") setAnclaSem(moverPeriodo("semana", anclaSem, d));
    else {
      const nuevo = moverPeriodo(tipo, ancla, d).slice(0, 7);
      ui.setMes(tipo === "año" ? `${nuevo.slice(0, 4)}-${ui.mes.slice(5)}` : nuevo);
    }
  }

  const titulo =
    tipo === "mes"
      ? `Gastado en ${nombreMes(ui.mes)}`
      : tipo === "año"
        ? `Gastado en ${ui.mes.slice(0, 4)}`
        : a.enCurso
          ? "Gastado esta semana"
          : `Semana del ${fechaCorta(a.inicio)}`;
  const anterior = tipo === "mes" ? nombreMes(moverPeriodo("mes", ancla, -1).slice(0, 7)) : tipo === "año" ? String(Number(ui.mes.slice(0, 4)) - 1) : "la semana pasada";

  const etiquetas =
    tipo === "año"
      ? (d) => mayus(MESES_CORTOS[Number(d.clave.slice(5)) - 1]).slice(0, 1)
      : tipo === "semana"
        ? (d, i) => DIAS_CORTOS[i]
        : (d, i) => {
            const dia = i + 1;
            const n = diasEnMes(ui.mes);
            return dia === 1 || dia === 8 || dia === 15 || dia === 22 || dia === n ? (dia === 1 ? `${MESES_CORTOS[Number(ui.mes.slice(5)) - 1]} 1` : dia) : "";
          };
  const datos = a.barras.map((b) => ({
    ...b,
    titulo: tipo === "año" ? mayus(MESES[Number(b.clave.slice(5)) - 1]) : fechaCorta(b.clave),
  }));

  const cats = verTodas ? a.categorias : a.categorias.slice(0, 4);

  return (
    <div className="analisis">
      <header className="titular">
        <h1>
          <em>Tus</em> análisis
        </h1>
        <button type="button" className="boton-redondo" onClick={() => ui.abrir("meses")} aria-label="Elegir mes">
          <CalendarDays size={20} />
        </button>
      </header>

      <Segmentado
        etiqueta="Periodo"
        valor={tipo}
        onCambio={setTipo}
        opciones={[
          { valor: "semana", texto: "Semana" },
          { valor: "mes", texto: "Mes" },
          { valor: "año", texto: "Año" },
        ]}
      />

      <section className="resumen-periodo area-resumen">
        <div>
          <div className="periodo-nav">
            <button type="button" className="boton-redondo mini" onClick={() => mover(-1)} aria-label="Periodo anterior">
              <ChevronLeft size={16} />
            </button>
            <span>{titulo}</span>
            <button type="button" className="boton-redondo mini" onClick={() => mover(1)} aria-label="Periodo siguiente">
              <ChevronRight size={16} />
            </button>
          </div>
          <Cifra valor={a.total} className="cifra-xl" />
          {a.variacion != null && !a.futuro ? (
            <p className="comparativa">
              <span className={`pill ${a.variacion <= 0 ? "pill-lima" : "pill-mal"}`}>
                {a.variacion <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                {pct1(Math.abs(a.variacion))}
              </span>
              {a.variacion <= 0 ? "menos" : "más"} que {anterior}
              {a.enCurso ? " a estas alturas" : ""}
            </p>
          ) : (
            <p className="comparativa tenue">{a.futuro ? "Este periodo aún no ha empezado" : `Sin gastos en ${anterior} para comparar`}</p>
          )}
        </div>
        <Anillo pct={a.usoPct} peligro={a.usoPct > 100}>
          <b>{Math.round(a.usoPct)}%</b>
          <small>del presupuesto</small>
        </Anillo>
      </section>

      <section className="tarjeta area-grafico">
        <div className="tarjeta-cab">
          <h2>{tipo === "año" ? "Gasto variable por mes" : "Gasto variable diario"}</h2>
          {a.media > 0 && (
            <span className={a.mediaPrevista > 0 && a.media > a.mediaPrevista ? "negativo" : "tenue"}>
              Media {eur(a.media, { corto: true })}/{tipo === "año" ? "mes" : "día"}
            </span>
          )}
        </div>
        <p className="ayuda tenue grafico-nota">
          Sin recibos (hipoteca, luz, suscripciones…).
          {a.mediaPrevista > 0 && ` Tu presupuesto variable da para ${eur(a.mediaPrevista, { corto: true })}/${tipo === "año" ? "mes" : "día"}.`}
        </p>
        <GraficoBarras datos={datos} media={a.media} etiquetas={etiquetas} />
      </section>

      <section className="seccion area-categorias">
        <div className="seccion-cab">
          <h2>Por categorías</h2>
          {a.categorias.length > 4 && (
            <button type="button" className="enlace" onClick={() => setVerTodas(!verTodas)}>
              {verTodas ? "Ver menos" : "Ver todas"}
            </button>
          )}
        </div>
        {cats.length ? (
          <div className="lista-categorias">
            {cats.map((c) => (
              <div key={c.categoria} className="categoria">
                <Ficha icono={iconoCategoria(c.categoria)} color={colorCategoria(c.categoria)} size={46} />
                <div className="categoria-cuerpo">
                  <div className="categoria-fila">
                    <b>
                      {c.categoria} <small>{Math.round(c.pct)}%</small>
                    </b>
                    <span>{eur(c.total)}</span>
                  </div>
                  <Barra pct={c.pct} color={colorCategoria(c.categoria)} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Vacio titulo="Sin gastos en este periodo" />
        )}
      </section>

      {tipo === "mes" && <EstadoPartidas />}
      {tipo === "año" && <ResumenAño />}
    </div>
  );
}

// Cómo va cada partida este mes frente a lo presupuestado
function EstadoPartidas() {
  const { db } = useDatos();
  const ui = useUI();
  const r = resumenMes(db, ui.mes);
  const acum = acumuladoAño(db, ui.mes);
  const mensuales = ordenar(db.partidas.filter((p) => esMensual(p) && (p.activa || r.gp.has(p.id))));
  const periodicas = ordenar(db.partidas.filter((p) => !esMensual(p) && (p.activa || acum.has(p.id))));
  const marca = r.fase === "actual" ? (r.dia / r.dias) * 100 : null;
  const sinPartida = r2(r.gp.get("_sin") || 0);

  const fila = (p, g, pres, sub) => {
    const e = estadoDe(g, pres);
    let resto;
    if (pres <= 0) resto = g > 0 ? "Sin presupuesto" : "—";
    else if (e === "completo") resto = "Justo lo previsto";
    else if (g <= pres) resto = `Quedan ${eur(pres - g, { corto: true })}`;
    else resto = `Te pasas ${eur(g - pres, { corto: true })}`;
    return (
      <button key={p.id} type="button" className="fila-estado" data-estado={e} onClick={() => p.activa && ui.abrir("apuntar", { tipo: "gasto", partidaId: p.id })}>
        <span className="fila-estado-cab">
          <b>{p.nombre}</b>
          <span>
            {eur(g, { corto: true })} <small>/ {eur(pres, { corto: true })}</small>
          </span>
        </span>
        <Barra pct={porcentaje(g, pres)} estado={e} marca={marca} />
        <small className="fila-estado-pie">
          <span>{sub}</span>
          <span className="resto">{resto}</span>
        </small>
      </button>
    );
  };

  return (
    <>
      <section className="seccion area-resto">
        <div className="seccion-cab">
          <h2>Partidas de {nombreMes(ui.mes)}</h2>
          <span className="tenue">Toca para apuntar</span>
        </div>
        {ordenCategorias(mensuales).map((cat) => (
          <div key={cat} className="grupo">
            <h3 className="grupo-titulo">{cat}</h3>
            <div className="lista">{ordenar(mensuales.filter((p) => p.categoria === cat)).map((p) => fila(p, r.gp.get(p.id) || 0, p.activa ? p.importe : 0, p.recibo ? "Recibo" : ""))}</div>
          </div>
        ))}
        {sinPartida !== 0 && <p className="ayuda">Además hay {eur(sinPartida)} en partidas que ya no existen.</p>}
        {marca != null && <p className="ayuda tenue">La rayita marca dónde deberías ir hoy si gastaras a ritmo constante (día {r.dia} de {r.dias}).</p>}
      </section>

      {periodicas.length > 0 && (
        <section className="seccion area-resto">
          <div className="seccion-cab">
            <h2>Pagos periódicos</h2>
            <span className="tenue">Acumulado {ui.mes.slice(0, 4)}</span>
          </div>
          <div className="lista">
            {periodicas.map((p) => fila(p, acum.get(p.id) || 0, p.activa ? anual(p) : 0, `${p.frecuencia} · ${eur(p.importe, { corto: true })}`))}
          </div>
        </section>
      )}
    </>
  );
}

// Resumen de cada mes del año: entró, salió, sobró
function ResumenAño() {
  const { db } = useDatos();
  const ui = useUI();
  const y = ui.mes.slice(0, 4);
  const act = mesEnCurso(db);
  const filas = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`)
    .filter((m) => m <= act)
    .map((m) => resumenMes(db, m))
    .filter((r) => r.movs.length || r.sueldo != null);
  if (!filas.length) return null;
  const totalSobra = r2(filas.reduce((s, r) => s + r.disponible, 0));
  return (
    <section className="seccion area-resto">
      <div className="seccion-cab">
        <h2>Mes a mes</h2>
        <span className={totalSobra >= 0 ? "positivo" : "negativo"}>{eur(totalSobra, { signo: true })} en total</span>
      </div>
      <div className="tabla-meses">
        <div className="tm-cab">
          <span>Mes</span>
          <span>Entró</span>
          <span>Salió</span>
          <span>Queda</span>
        </div>
        {filas.map((r) => (
          <button
            key={r.mes}
            type="button"
            className="tm-fila"
            onClick={() => {
              ui.setMes(r.mes);
              ui.irA("inicio");
            }}
          >
            <span>{mayus(nombreMes(r.mes))}</span>
            <span>{eur(r.entradas, { corto: true })}</span>
            <span>{eur(r.gastado + r.ahorrado, { corto: true })}</span>
            <b className={r.disponible >= 0 ? "positivo" : "negativo"}>{eur(r.disponible, { signo: true, corto: true })}</b>
          </button>
        ))}
      </div>
    </section>
  );
}
