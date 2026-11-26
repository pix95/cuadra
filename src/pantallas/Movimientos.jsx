import { useMemo, useState } from "react";
import { Search, X, Plus } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Navegador, Vacio, Cifra } from "../components/comunes.jsx";
import { FilaMovimiento, ordenarMovs, describirMovimiento } from "../components/FilaMovimiento.jsx";
import { ordenCategorias, ordenar, esAjuste, mesDe, mesEnCurso } from "../lib/calculos.js";
import { eur, nombreMes, moverMes, fechaRelativa, sum, r2 } from "../lib/formato.js";

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Movimientos() {
  const { db } = useDatos();
  const ui = useUI();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [partida, setPartida] = useState("");
  const [todoElAño, setTodoElAño] = useState(false);
  const buscando = q.trim().length > 0;

  const lista = useMemo(() => {
    const t = norm(q.trim());
    // Al buscar se mira en todos los meses
    // Lo que ya tenías ahorrado antes de usar la app se ve en Ahorros, no aquí
    let ms = buscando ? db.movimientos : db.movimientos.filter((m) => mesDe(m).startsWith(todoElAño ? ui.mes.slice(0, 4) : ui.mes));
    if (tipo !== "todos") ms = ms.filter((m) => m.tipo === tipo);
    if (partida) ms = ms.filter((m) => m.partidaId === partida);
    if (t) {
      ms = ms.filter((m) => {
        const d = describirMovimiento(m, db);
        return norm(`${m.concepto} ${d.titulo} ${d.sub} ${String(m.importe).replace(".", ",")}`).includes(t);
      });
    }
    return ordenarMovs(ms);
  }, [db, q, tipo, partida, ui.mes, buscando, todoElAño]);

  const gastos = r2(sum(lista.filter((m) => m.tipo === "gasto"), (m) => m.importe));
  const ingresos = r2(sum(lista.filter((m) => m.tipo === "ingreso"), (m) => m.importe));
  const ahorro = r2(sum(lista.filter((m) => m.tipo === "ahorro"), (m) => m.importe));

  const dias = new Map();
  for (const m of lista) {
    if (!dias.has(m.fecha)) dias.set(m.fecha, []);
    dias.get(m.fecha).push(m);
  }
  const activas = db.partidas.filter((p) => p.activa || db.movimientos.some((m) => m.partidaId === p.id));

  return (
    <div className="movimientos">
      <header className="titular">
        <h1>
          <em>Tus</em> movimientos
        </h1>
        <button type="button" className="boton-redondo" onClick={() => ui.abrir("apuntar", { tipo: "gasto" })} aria-label="Apuntar">
          <Plus size={22} />
        </button>
      </header>

      {!buscando && (
        <Navegador
          texto={todoElAño ? `Todo ${ui.mes.slice(0, 4)}` : nombreMes(ui.mes, { año: true, cap: true })}
          onAnterior={() => ui.setMes(moverMes(ui.mes, todoElAño ? -12 : -1))}
          onSiguiente={() => ui.setMes(moverMes(ui.mes, todoElAño ? 12 : 1))}
          onTexto={() => ui.setMes(mesEnCurso(db))}
          tituloTexto="Volver al mes actual"
        />
      )}

      <label className="buscador">
        <Search size={18} />
        <input type="search" placeholder="Buscar en todos los meses…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={Boolean(ui.extra?.buscar)} />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Borrar búsqueda">
            <X size={16} />
          </button>
        )}
      </label>

      <div className="filtros">
        <div className="chips">
          {[
            ["todos", "Todos"],
            ["gasto", "Gastos"],
            ["ingreso", "Ingresos"],
            ["ahorro", "Ahorro"],
          ].map(([v, t]) => (
            <button key={v} type="button" className="chip" aria-pressed={tipo === v} onClick={() => setTipo(v)}>
              {t}
            </button>
          ))}
          {!buscando && (
            <button type="button" className="chip" aria-pressed={todoElAño} onClick={() => setTodoElAño(!todoElAño)}>
              Todo el año
            </button>
          )}
        </div>
        {(tipo === "todos" || tipo === "gasto") && (
          <select className="select" value={partida} onChange={(e) => setPartida(e.target.value)} aria-label="Filtrar por partida">
            <option value="">Todas las partidas</option>
            {ordenCategorias(activas).map((c) => (
              <optgroup key={c} label={c}>
                {ordenar(activas.filter((p) => p.categoria === c)).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.activa ? "" : " (archivada)"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      <div className="totales">
        <div>
          <small>Gastos</small>
          <Cifra valor={gastos} />
        </div>
        {ingresos !== 0 && (
          <div>
            <small>Ingresos</small>
            <Cifra valor={ingresos} className="positivo" />
          </div>
        )}
        {ahorro !== 0 && (
          <div>
            <small>Ahorro</small>
            <Cifra valor={ahorro} />
          </div>
        )}
        <div className="totales-n">
          <small>{buscando ? "Encontrados" : "Movimientos"}</small>
          <b>{lista.length}</b>
        </div>
      </div>

      {lista.length === 0 ? (
        <Vacio titulo={buscando ? "No hay nada con esa búsqueda" : "Nada apuntado"}>{buscando ? "Prueba con otra palabra o un importe." : "Usa el botón + para apuntar un gasto."}</Vacio>
      ) : (
        [...dias.entries()].map(([fecha, ms]) => {
          // Los ajustes no cuentan en el total del día (no son gasto ni ingreso)
          const neto = r2(sum(ms.filter((m) => !esAjuste(m)), (m) => (m.tipo === "ingreso" ? m.importe : -m.importe)));
          return (
            <section key={fecha} className="dia">
              <h3>
                <span>{fechaRelativa(fecha)}</span>
                <span>{eur(neto, { signo: true })}</span>
              </h3>
              <div className="lista">
                {ms.map((m) => (
                  <FilaMovimiento key={m.id} m={m} db={db} conFecha={false} onClick={() => ui.abrir(esAjuste(m) ? "ajuste" : "apuntar", { movimiento: m })} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
