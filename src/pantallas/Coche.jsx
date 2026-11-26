// Cuaderno del coche: lo que cuesta, recordatorios, consumo, precio del
// combustible e historial de repostajes y mantenimientos.
import { useState } from "react";
import { Fuel, Wrench, Settings, Plus, ChevronRight, TriangleAlert, Car, Gauge } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Cifra, Segmentado, Vacio, Barra } from "../components/comunes.jsx";
import { GraficoBarras } from "../components/GraficoBarras.jsx";
import { Ficha } from "../lib/iconos.jsx";
import { resumenCoche, vehiculoPrincipal, precioLitro, porcentaje, estadoDe } from "../lib/calculos.js";
import { COMBUSTIBLES, TIPOS_MANTENIMIENTO } from "../../shared/modelo.js";
import { eur, fechaCorta, fechaRelativa, nombreMes, mesActual, mayus } from "../lib/formato.js";

export const num = (n, dec = 1) => (n == null ? "—" : n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec }));
export const kmTxt = (n) => `${Math.round(n).toLocaleString("es-ES")} km`;
export const unidad = (v) => (v?.combustible === "electrico" ? "kWh" : "l");
const ICONO_MANT = { revision: "taller", itv: "calendario", aceite: "agua", neumaticos: "coche", reparacion: "obras", otro: "taller" };
const ICONO_REC = { itv: "calendario", revision: "taller", seguro: "seguro", impuesto: "banco", aceite: "agua", otro: "calendario" };
const ESTADO_REC = { vencido: "Vencido", pronto: "Pronto", "al-dia": "Al día" };

export default function Coche() {
  const { db } = useDatos();
  const ui = useUI();
  const v = vehiculoPrincipal(db);
  if (!v) return <Bienvenida />;

  const res = resumenCoche(db, v);
  const u = unidad(v);
  const cm = res.combustibleMes;

  return (
    <div className="coche">
      <header className="titular">
        <h1>
          <em>Tu</em> coche
        </h1>
        <button type="button" className="boton-redondo" onClick={() => ui.abrir("vehiculo", { vehiculo: v })} aria-label="Ajustes del vehículo">
          <Settings size={20} />
        </button>
      </header>

      {/* 1. Lo que cuesta */}
      <section className="tarjeta fondo-degradado coche-coste ac-coste">
        <div className="coche-coste-cab">
          <span>
            <small>{v.nombre} te cuesta al mes</small>
            <Cifra valor={res.coste.alMes} className="coche-coste-cifra" />
          </span>
          <Ficha icono="coche" color="#ffc7a8" size={46} />
        </div>
        <p className="coche-coste-nota">
          {res.coste.combustible + res.coste.mantenimiento > 0
            ? `Combustible y mantenimiento (media de ${res.coste.meses >= 11.5 ? "12 meses" : res.coste.meses < 1.5 ? "1 mes" : `${Math.round(res.coste.meses)} meses`})`
            : "Aún sin gastos de combustible ni mantenimiento"}
          {res.coste.fijos > 0 && ` + ${res.coste.partidas.map((x) => x.partida.nombre.toLowerCase()).join(", ")} (${eur(res.coste.fijos, { corto: true })})`}
        </p>
        <dl className="coche-datos">
          <div>
            <dt>Combustible</dt>
            <dd>{res.coste.porKmCombustible != null ? `${num(res.coste.porKmCombustible, 3)} €/km` : "—"}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{res.coste.porKmTotal != null ? `${num(res.coste.porKmTotal, 3)} €/km` : "—"}</dd>
          </div>
          <div>
            <dt>Consumo</dt>
            <dd>{res.consumo != null ? `${num(res.consumo)} ${u}/100` : "—"}</dd>
          </div>
          <div>
            <dt>Km al mes</dt>
            <dd>{res.coste.km.alMes != null ? Math.round(res.coste.km.alMes).toLocaleString("es-ES") : "—"}</dd>
          </div>
        </dl>
        {res.coste.km.alAño != null && <p className="coche-coste-nota">Unos {kmTxt(res.coste.km.alAño)} al año · el cuentakilómetros andará por los {kmTxt(res.kmHoy)}</p>}
      </section>

      {res.aviso && (
        <div className="tarjeta coche-aviso ac-aviso">
          <TriangleAlert size={20} />
          <p>
            <b>
              Consumo alto: {num(res.aviso.ultimo.consumo)} {u}/100 km en el último tramo
            </b>
            Un {Math.round(res.aviso.exceso)} % más que tu media ({num(res.aviso.media)}). Puede ser la conducción, la presión de las ruedas o una avería.
          </p>
        </div>
      )}

      {/* 2. Recordatorios */}
      <section className="seccion ac-recordatorios">
        <div className="seccion-cab">
          <h2>Recordatorios</h2>
          <button type="button" className="enlace" onClick={() => ui.abrir("recordatorio", { vehiculoId: v.id })}>
            <Plus size={14} /> Añadir
          </button>
        </div>
        {res.recordatorios.length ? (
          <div className="lista">
            {res.recordatorios.map((e) => (
              <button key={e.recordatorio.id} type="button" className="fila-mov" onClick={() => ui.abrir("recordatorio", { recordatorio: e.recordatorio, vehiculoId: v.id })}>
                <Ficha icono={ICONO_REC[e.recordatorio.tipo]} color={e.estado === "vencido" ? "#ff8a95" : e.estado === "pronto" ? "#f4cf6a" : "#64dccb"} size={42} />
                <span className="fila-mov-txt">
                  <b>{e.nombre}</b>
                  <small>
                    {mayus(e.cuando)}
                    {e.recordatorio.proximaFecha && e.dias >= 0 ? ` · ${fechaCorta(e.recordatorio.proximaFecha)}` : ""}
                    {e.recordatorio.proximosKm != null && e.km >= 0 && e.recordatorio.proximaFecha ? ` · a los ${kmTxt(e.recordatorio.proximosKm)}` : ""}
                  </small>
                </span>
                <span className={`estado-rec ${e.estado}`}>{ESTADO_REC[e.estado]}</span>
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="tarjeta coche-vacio" onClick={() => ui.abrir("recordatorio", { vehiculoId: v.id, tipo: "itv" })}>
            <Plus size={18} /> Añade la ITV, la revisión o el seguro y te avisaré antes de que toque
          </button>
        )}
      </section>

      {/* 3. Botones */}
      <div className="acciones coche-acciones ac-acciones">
        <button type="button" className="accion principal" onClick={() => ui.abrir("repostaje", { vehiculoId: v.id })}>
          <span>
            <Fuel size={24} />
          </span>
          Repostar
        </button>
        <button type="button" className="accion" onClick={() => ui.abrir("mantenimiento", { vehiculoId: v.id })}>
          <span>
            <Wrench size={24} />
          </span>
          Mantenimiento
        </button>
      </div>

      {cm.partida && (
        <section className="tarjeta coche-mes ac-mes">
          <div className="tarjeta-cab">
            <h2>
              {cm.partida.nombre} de {nombreMes(mesActual())}
            </h2>
            <span className={cm.presupuesto && cm.gastado > cm.presupuesto ? "negativo" : "tenue"}>
              {eur(cm.gastado, { corto: true })}
              {cm.presupuesto ? ` de ${eur(cm.presupuesto, { corto: true })}` : ""}
            </span>
          </div>
          {cm.presupuesto > 0 && <Barra pct={porcentaje(cm.gastado, cm.presupuesto)} estado={estadoDe(cm.gastado, cm.presupuesto)} />}
        </section>
      )}

      {/* 4. Consumo */}
      <section className="tarjeta ac-consumo">
        <div className="tarjeta-cab">
          <h2>Consumo por tramo</h2>
          {res.consumo != null && <span className="tenue">Media {num(res.consumo)} {u}/100 km</span>}
        </div>
        {res.tramos.length ? (
          <>
            <p className="ayuda tenue grafico-nota">De lleno a lleno: los litros que caben entre dos repostajes con el depósito lleno, entre los km recorridos.</p>
            <GraficoBarras
              datos={res.tramos.slice(-12).map((t) => ({ clave: `${t.hasta}-${t.kmHasta}`, valor: t.consumo, titulo: `${fechaCorta(t.hasta)} · ${kmTxt(t.km)}` }))}
              media={res.consumo}
              alto={120}
              minimo={Math.max(0, Math.min(...res.tramos.slice(-12).map((t) => t.consumo)) * 0.75)}
              formato={(x) => `${num(x)} ${u}/100`}
              etiquetas={(d) => fechaCorta(d.clave.slice(0, 10))}
            />
          </>
        ) : (
          <Vacio titulo="Aún no hay consumo" icono={<Gauge size={22} />}>
            Aparece a partir del segundo repostaje con el depósito lleno.
          </Vacio>
        )}
      </section>

      {/* 5. Precio por litro */}
      {res.precios.serie.length > 0 && (
        <section className="tarjeta ac-precio">
          <div className="tarjeta-cab">
            <h2>Precio por {u === "l" ? "litro" : "kWh"}</h2>
            <span className="tenue">
              Último {num(res.precios.ultimo, 3)} € · media {num(res.precios.media, 3)} €
            </span>
          </div>
          <GraficoBarras
            datos={res.precios.serie.slice(-12).map((p) => ({ clave: p.id, valor: p.precio, titulo: fechaCorta(p.fecha), fecha: p.fecha }))}
            media={res.precios.media}
            alto={100}
            minimo={Math.max(0, Math.min(...res.precios.serie.slice(-12).map((p) => p.precio)) * 0.9)}
            formato={(x) => `${num(x, 3)} €/${u}`}
            etiquetas={(d) => fechaCorta(d.fecha)}
          />
        </section>
      )}

      {/* 6. Historial */}
      <Historial v={v} res={res} />

      {/* 7. Ajustes */}
      <button type="button" className="tarjeta coche-ajustes ac-ajustes" onClick={() => ui.abrir("vehiculo", { vehiculo: v })}>
        <Ficha icono="coche" color="#78c6f2" size={42} />
        <span className="fila-mov-txt">
          <b>{v.nombre}</b>
          <small>
            {COMBUSTIBLES[v.combustible]} · {[db.partidas.find((p) => p.id === v.partidaCombustible)?.nombre, db.partidas.find((p) => p.id === v.partidaMantenimiento)?.nombre].filter(Boolean).join(" y ") || "sin partidas"}
          </small>
        </span>
        <ChevronRight size={18} className="tenue" />
      </button>
    </div>
  );
}

function Historial({ v, res }) {
  const ui = useUI();
  const [filtro, setFiltro] = useState("todo");
  const u = unidad(v);
  const lista = [
    ...(filtro !== "mant" ? res.repostajes.map((r) => ({ tipo: "rep", fecha: r.fecha, x: r })) : []),
    ...(filtro !== "rep" ? res.mantenimientos.map((m) => ({ tipo: "mant", fecha: m.fecha, x: m })) : []),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.x.km ?? 0) - (a.x.km ?? 0));
  const [ver, setVer] = useState(10);

  return (
    <section className="seccion ac-historial">
      <div className="seccion-cab">
        <h2>Historial</h2>
      </div>
      <Segmentado
        peq
        etiqueta="Filtrar el historial"
        valor={filtro}
        onCambio={setFiltro}
        opciones={[
          { valor: "todo", texto: "Todo" },
          { valor: "rep", texto: "Repostajes" },
          { valor: "mant", texto: "Mantenimiento" },
        ]}
      />
      {lista.length ? (
        <div className="lista">
          {lista.slice(0, ver).map(({ tipo, x }) =>
            tipo === "rep" ? (
              <button key={x.id} type="button" className="fila-mov" onClick={() => ui.abrir("repostaje", { repostaje: x, vehiculoId: v.id })}>
                <Ficha icono="gasolina" color="#78c6f2" size={42} />
                <span className="fila-mov-txt">
                  <b>{x.gasolinera || (x.lleno ? "Repostaje" : "Repostaje parcial")}</b>
                  <small>
                    {fechaRelativa(x.fecha)} · {num(x.litros, 2)} {u} · {kmTxt(x.km)}
                    {x.lleno ? "" : " · parcial"}
                  </small>
                </span>
                <span className="fila-mov-imp">
                  <b>{eur(-x.importe, { signo: true })}</b>
                  <small>{num(precioLitro(x), 3)} €/{u}</small>
                </span>
              </button>
            ) : (
              <button key={x.id} type="button" className="fila-mov" onClick={() => ui.abrir("mantenimiento", { mantenimiento: x, vehiculoId: v.id })}>
                <Ficha icono={ICONO_MANT[x.tipo]} color="#f6a57c" size={42} />
                <span className="fila-mov-txt">
                  <b>{TIPOS_MANTENIMIENTO[x.tipo]}</b>
                  <small>{[fechaRelativa(x.fecha), x.taller, x.km != null && kmTxt(x.km)].filter(Boolean).join(" · ")}</small>
                </span>
                <span className="fila-mov-imp">
                  <b>{eur(-x.importe, { signo: true })}</b>
                  <small>Mantenimiento</small>
                </span>
              </button>
            )
          )}
        </div>
      ) : (
        <Vacio titulo="Nada por aquí todavía">Pulsa «Repostar» la próxima vez que eches combustible.</Vacio>
      )}
      {lista.length > ver && (
        <button type="button" className="btn btn-texto ver-mas" onClick={() => setVer((n) => n + 20)}>
          Ver más
        </button>
      )}
    </section>
  );
}

// La primera vez: un asistente corto en lugar de pantallas vacías
function Bienvenida() {
  const ui = useUI();
  return (
    <div className="coche">
      <header className="titular">
        <h1>
          <em>Tu</em> coche
        </h1>
      </header>
      <section className="tarjeta fondo-degradado coche-bienvenida">
        <Car size={34} />
        <h2>Lleva el coche dentro de Cuadra</h2>
        <ul>
          <li>Repostajes y consumo real (l/100 km)</li>
          <li>Mantenimientos pagados, también desde la hucha</li>
          <li>Avisos de la ITV, la revisión y el seguro</li>
          <li>Lo que te cuesta al mes y por kilómetro</li>
        </ul>
        <p>Solo necesito el nombre, los km que marca ahora y en qué partidas apuntas la gasolina y el taller. El consumo aparece a partir del segundo repostaje con el depósito lleno.</p>
        <button type="button" className="btn btn-primario" onClick={() => ui.abrir("vehiculo", { asistente: true })}>
          <Car size={18} /> Configurar mi coche
        </button>
      </section>
    </div>
  );
}
