// Áreas: una tarjeta por categoría del presupuesto (Vivienda, Transporte,
// Deporte…) y, al tocarla, su página: cómo va este mes, la evolución, sus
// partidas, los próximos recibos y los últimos gastos. En el área de los
// vehículos (Transporte), además, una tarjeta por vehículo y otra para añadir.
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Car, TriangleAlert, Lightbulb, CalendarClock, ArrowUpRight } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Barra, Cifra, Vacio } from "../components/comunes.jsx";
import { GraficoBarras } from "../components/GraficoBarras.jsx";
import { FilaMovimiento } from "../components/FilaMovimiento.jsx";
import { Ficha, colorCategoria, iconoCategoria } from "../lib/iconos.jsx";
import { areas, resumenArea, esAreaDeVehiculos, resumenCoche, porcentaje, esMensual, partidasFrecuentes } from "../lib/calculos.js";
import { COMBUSTIBLES } from "../../shared/modelo.js";
import { eur, nombreMes, mesCorto, mayus, MESES_CORTOS } from "../lib/formato.js";
import { num, kmTxt, unidad } from "./Coche.jsx";

export default function Areas() {
  const ui = useUI();
  return ui.sub ? <Area cat={ui.sub} /> : <ListaAreas />;
}

// ---------- Todas las áreas ----------
function ListaAreas() {
  const { db } = useDatos();
  const ui = useUI();
  const lista = areas(db, ui.mes);
  const presupuesto = lista.reduce((s, a) => s + a.presupuestoMensual, 0);
  const gastado = lista.reduce((s, a) => s + a.gastadoMensual, 0);
  const peor = lista
    .filter((a) => a.presupuestoMensual > 0 && a.gastadoMensual > a.presupuestoMensual)
    .sort((a, b) => b.gastadoMensual / b.presupuestoMensual - a.gastadoMensual / a.presupuestoMensual)[0];

  return (
    <div className="areas">
      <header className="titular">
        <h1>
          <em>Tus</em> áreas
        </h1>
        <button type="button" className="boton-redondo" onClick={() => ui.abrir("meses")} aria-label="Elegir mes">
          <CalendarDays size={20} />
        </button>
      </header>

      <section className="tarjeta areas-resumen">
        <small>{mayus(nombreMes(ui.mes, { año: true }))} · gasto mensual</small>
        <p>
          <b>{eur(gastado)}</b> de {eur(presupuesto)}
        </p>
        <Barra pct={porcentaje(gastado, presupuesto)} estado={gastado > presupuesto ? "pasado" : gastado / (presupuesto || 1) >= 0.85 ? "cerca" : "ok"} />
        <small className="tenue">
          {peor
            ? `${peor.categoria} va al ${Math.round((peor.gastadoMensual / peor.presupuestoMensual) * 100)} % de su presupuesto.`
            : "Toca un área para ver su evolución, sus partidas y sus próximos recibos."}
        </small>
      </section>

      <div className="areas-rejilla">
        {lista.map((a) => (
          <TarjetaArea key={a.categoria} a={a} />
        ))}
      </div>
    </div>
  );
}

function TarjetaArea({ a }) {
  const ui = useUI();
  const color = colorCategoria(a.categoria);
  const soloNoMensual = a.presupuestoMensual === 0 && a.noMensuales.length > 0;
  return (
    <button type="button" className={`tarjeta area-tarjeta ${a.estado === "pasado" ? "pasada" : ""}`} onClick={() => ui.irA("areas", {}, a.categoria)} style={{ "--c": color }}>
      <div className="area-cab">
        <Ficha icono={iconoCategoria(a.categoria)} color={color} size={40} />
        {a.vehiculos.length > 0 && (
          <span className="area-extra" title="Vehículos">
            <Car size={14} /> {a.vehiculos.length}
          </span>
        )}
      </div>
      <b className="area-nombre">{a.categoria}</b>
      {soloNoMensual ? (
        <small>{eur(a.presupuesto, { corto: true })}/mes de media</small>
      ) : (
        <>
          <small>
            {eur(a.gastadoMensual, { corto: true })} de {eur(a.presupuestoMensual, { corto: true })}
          </small>
          <Barra pct={porcentaje(a.gastadoMensual, a.presupuestoMensual)} estado={a.estado} />
        </>
      )}
      {a.aviso && <span className={`area-aviso nivel-${a.aviso.nivel}`}>{mayus(a.aviso.texto)}</span>}
    </button>
  );
}

// ---------- Un área ----------
function Area({ cat }) {
  const { db } = useDatos();
  const ui = useUI();
  const a = resumenArea(db, cat, ui.mes);
  const color = colorCategoria(cat);
  const conVehiculos = esAreaDeVehiculos(db, cat);
  // Para «Apuntar un gasto»: la partida del área que más usas
  const frecuente = partidasFrecuentes(db, 40).find((p) => p.categoria === cat) || a.partidas[0];
  const datos = a.serie.map((x) => ({ clave: x.mes, valor: x.gastado, futuro: false, titulo: mayus(nombreMes(x.mes, { año: true })) }));

  return (
    <div className="area">
      <button type="button" className="volver" onClick={() => ui.irA("areas")}>
        <ChevronLeft size={16} /> Áreas
      </button>
      <header className="titular area-titular">
        <Ficha icono={iconoCategoria(cat)} color={color} size={46} />
        <h1>{cat}</h1>
        <button type="button" className="boton-redondo" onClick={() => ui.abrir("meses")} aria-label="Elegir mes">
          <CalendarDays size={20} />
        </button>
      </header>

      {conVehiculos && <Vehiculos a={a} />}

      <section className="tarjeta area-mes">
        <div className="tarjeta-cab">
          <h2>{mayus(nombreMes(ui.mes, { año: true }))}</h2>
          {a.anterior > 0 && <span className="tenue">{nombreMes(mesAnterior(ui.mes))}: {eur(a.anterior, { corto: true })}</span>}
        </div>
        <Cifra valor={a.gastado} className="area-cifra" />
        {a.presupuestoMensual > 0 && (
          <>
            <p className="area-linea">
              Partidas de cada mes: {eur(a.gastadoMensual)} de {eur(a.presupuestoMensual)}
            </p>
            <Barra pct={porcentaje(a.gastadoMensual, a.presupuestoMensual)} estado={a.estado} />
          </>
        )}
        {a.noMensuales.length > 0 && (
          <p className="area-linea tenue">
            Recibos no mensuales: {eur(a.noMensuales.reduce((s, p) => s + p.importe * ({ Bimestral: 6, Trimestral: 4, Semestral: 2, Anual: 1 }[p.frecuencia] || 1), 0))} al año · se pagan
            de la hucha
          </p>
        )}
        {a.media != null && (
          <p className="area-linea">
            De media te cuesta <b>{eur(a.media)}</b> al mes · presupuesto {eur(a.presupuesto)}
          </p>
        )}
        {a.consejo && (
          <p className="aviso-linea area-consejo">
            <Lightbulb size={16} />
            <span>
              {a.consejo.tipo === "bajar"
                ? `En los últimos ${a.consejo.meses} meses has gastado de media ${eur(-a.consejo.dif)} menos de lo presupuestado cada mes. Podrías bajar el presupuesto y apartar la diferencia.`
                : `En los últimos ${a.consejo.meses} meses te has pasado de media ${eur(a.consejo.dif)} cada mes. Quizá toca subir el presupuesto o recortar.`}
            </span>
          </p>
        )}
        {frecuente && (
          <button type="button" className="btn btn-primario area-apuntar" onClick={() => ui.abrir("apuntar", { tipo: "gasto", partidaId: frecuente.id })}>
            <ArrowUpRight size={17} /> Apuntar un gasto
          </button>
        )}
      </section>

      <section className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Últimos 12 meses</h2>
          {a.media != null && <span className="tenue">Media {eur(a.media, { corto: true })}/mes</span>}
        </div>
        <GraficoBarras datos={datos} media={a.media || 0} alto={110} vacio="Aún no hay gastos en esta área" etiquetas={(d) => mayus(MESES_CORTOS[Number(d.clave.slice(5)) - 1]).slice(0, 3)} />
      </section>

      <section className="seccion">
        <div className="seccion-cab">
          <h2>Partidas</h2>
        </div>
        {a.porPartida.length ? (
          <div className="lista">
            {a.porPartida.map(({ partida: p, gastado, estado, proximo }) => (
              <button key={p.id} type="button" className="fila-mov area-partida" onClick={() => ui.abrir("partida", { partida: p })}>
                <Ficha icono={p.icono} color={color} size={40} />
                <span className="fila-mov-txt">
                  <b>{p.nombre}</b>
                  <small>
                    {esMensual(p)
                      ? `${eur(gastado, { corto: true })} de ${eur(p.importe, { corto: true })}${p.recibo ? " · recibo" : ""}`
                      : `${p.frecuencia} · ${proximo ? `próximo: ${mesCorto(proximo, { año: true }).toLowerCase()}` : "sin fecha de cobro"}`}
                  </small>
                  {esMensual(p) && p.importe > 0 && <Barra pct={porcentaje(gastado, p.importe)} estado={estado} />}
                </span>
                <ChevronRight size={16} className="tenue" />
              </button>
            ))}
          </div>
        ) : (
          <Vacio titulo="Sin partidas activas">Las partidas de esta categoría están archivadas.</Vacio>
        )}
      </section>

      {a.proximos.length > 0 && (
        <section className="seccion">
          <div className="seccion-cab">
            <h2>
              <CalendarClock size={18} /> Próximos recibos
            </h2>
          </div>
          <div className="lista">
            {a.proximos.slice(0, 6).map((c) => (
              <div key={`${c.mes}-${c.partida.id}`} className="cobro">
                <span className="cobro-mes">{mesCorto(c.mes, { año: true })}</span>
                <span className="cobro-nombre">{c.partida.nombre}</span>
                <b>{eur(c.importe)}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="seccion">
        <div className="seccion-cab">
          <h2>Últimos gastos</h2>
        </div>
        {a.ultimos.length ? (
          <div className="lista">
            {a.ultimos.map((m) => (
              <FilaMovimiento key={m.id} m={m} db={db} onClick={() => ui.abrir("apuntar", { movimiento: m })} />
            ))}
          </div>
        ) : (
          <Vacio titulo="Nada apuntado todavía">Los gastos de {cat.toLowerCase()} saldrán aquí.</Vacio>
        )}
      </section>
    </div>
  );
}
const mesAnterior = (m) => {
  const [y, mm] = m.split("-").map(Number);
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, "0")}`;
};

// ---------- Vehículos del área ----------
function Vehiculos({ a }) {
  const { db } = useDatos();
  const ui = useUI();
  return (
    <section className="seccion vehiculos">
      <div className="seccion-cab">
        <h2>Tus vehículos</h2>
      </div>
      <div className="vehiculos-rejilla">
        {a.vehiculos.map((v) => {
          const r = resumenCoche(db, v);
          const rec = r.recordatorios.find((e) => e.estado !== "al-dia") || r.recordatorios[0];
          return (
            <button key={v.id} type="button" className="tarjeta fondo-degradado vehiculo-tarjeta" onClick={() => ui.irA("coche", {}, v.id)}>
              <span className="vehiculo-cab">
                <Car size={22} />
                <span>
                  <b>{v.nombre}</b>
                  <small>{COMBUSTIBLES[v.combustible]}</small>
                </span>
              </span>
              <span className="vehiculo-cifra">
                {eur(r.coste.alMes, { corto: true })}
                <small>/mes</small>
              </span>
              <span className="vehiculo-datos">
                {[r.consumo != null && `${num(r.consumo)} ${unidad(v)}/100`, kmTxt(r.kmHoy), r.coste.km.alMes != null && `${r.coste.km.alMes.toLocaleString("es-ES")} km/mes`].filter(Boolean).join(" · ")}
              </span>
              {rec && (
                <span className={`vehiculo-rec estado-rec ${rec.estado}`}>
                  {rec.estado !== "al-dia" && <TriangleAlert size={12} />} {mayus(rec.texto)}
                </span>
              )}
            </button>
          );
        })}
        <button type="button" className="tarjeta vehiculo-nuevo" onClick={() => ui.abrir("vehiculo", { asistente: true })}>
          <span className="vehiculo-mas">
            <Plus size={26} />
          </span>
          <b>{a.vehiculos.length ? "Añadir otro vehículo" : "Añadir tu vehículo"}</b>
          <small>Repostajes, consumo, mantenimiento y avisos</small>
        </button>
      </div>
    </section>
  );
}
