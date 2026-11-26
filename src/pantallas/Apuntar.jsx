// Pantalla para apuntar (o corregir) un gasto, un ingreso o un ahorro,
// con teclado numérico y "desliza para apuntar".
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, CalendarDays, Trash2, ChevronsUpDown, Plus, Undo2, PencilLine, LayoutGrid, Zap } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { Teclado, aplicarTecla, valorTeclado, tecladoDe, CifraTecleada, Deslizar, Segmentado, Interruptor, useDesplazarConRaton } from "../components/comunes.jsx";
import { Ficha, colorCategoria } from "../lib/iconos.jsx";
import { partidasFrecuentes, esMensual, anual, gastosPorPartida, ahorradoObjetivo, objetivosConFijo, AHORRO_PRINCIPAL, OBJETIVO_FIJO } from "../lib/calculos.js";
import { eur, hoyISO, mesActual, diasEnMes, fechaRelativa, fechaCorta, nombreMes, r2 } from "../lib/formato.js";

const TITULOS = { gasto: ["Nuevo gasto", "Editar gasto"], ingreso: ["Nuevo ingreso", "Editar ingreso"], ahorro: ["Apartar ahorro", "Editar ahorro"] };
const CONCEPTOS_INGRESO = [
  { texto: "Extra", icono: "ia" },
  { texto: "Bizum", icono: "movil" },
  { texto: "Hacienda", icono: "banco" },
  { texto: "Venta", icono: "paquete" },
  { texto: "Regalo", icono: "regalo" },
  { texto: "Reembolso", icono: "cartera" },
];

function fechaPorDefecto(mes) {
  const act = mesActual();
  if (mes === act) return hoyISO();
  if (mes < act) return `${mes}-${String(diasEnMes(mes)).padStart(2, "0")}`;
  return `${mes}-01`;
}
const nombreCorto = (n) => n.replace(/\s*\(.*\)\s*$/, "");

export default function Apuntar({ cerrar, tipo: tipoInicial = "gasto", movimiento = null, partidaId: pInicial = "", objetivoId: oInicial = "", importe: impInicial }) {
  const { db, acc } = useDatos();
  const ui = useUI();
  const editando = Boolean(movimiento);

  const [tipo, setTipo] = useState(movimiento?.tipo || tipoInicial);
  const [valor, setValor] = useState(movimiento ? tecladoDe(movimiento.importe) : impInicial ? tecladoDe(impInicial) : "");
  const [negativo, setNegativo] = useState(movimiento ? movimiento.importe < 0 : false);
  const [partidaId, setPartidaId] = useState(movimiento?.partidaId || pInicial || "");
  const [objetivoId, setObjetivoId] = useState(movimiento?.objetivoId || oInicial || AHORRO_PRINCIPAL.id);
  const [fecha, setFecha] = useState(movimiento?.fecha || fechaPorDefecto(ui.mes));
  const [concepto, setConcepto] = useState(movimiento?.concepto || "");
  const [verNota, setVerNota] = useState(Boolean(movimiento?.concepto));
  const [borrar, setBorrar] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Recibos no mensuales: se pagan desde la hucha «Recibos no mensuales» (activado por defecto)
  const [desdeHucha, setDesdeHucha] = useState(movimiento ? Boolean(movimiento.enlace) || movimiento.tipo !== "gasto" : true);
  const inputFecha = useRef(null);
  const raiz = useRef(null);
  const filaRapida = useDesplazarConRaton();
  // El foco pasa a esta pantalla (si no, Intro pulsaría el botón de detrás)
  useEffect(() => {
    if (!raiz.current?.contains(document.activeElement)) raiz.current?.focus({ preventScroll: true });
  }, []);

  const partida = db.partidas.find((p) => p.id === partidaId);
  const objetivo = objetivosConFijo(db).find((o) => o.id === objetivoId);
  const importe = valorTeclado(valor);

  const frecuentes = useMemo(() => {
    const lista = partidasFrecuentes(db, 8);
    if (partida && !lista.some((p) => p.id === partida.id)) lista.unshift(partida);
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.partidas, db.movimientos.length, partidaId]);

  // Lo que queda en la partida (sin contar el propio movimiento si se está corrigiendo)
  const infoPartida = useMemo(() => {
    if (!partida) return null;
    const otros = db.movimientos.filter((m) => m.id !== movimiento?.id);
    if (esMensual(partida)) {
      const mes = fecha.slice(0, 7);
      const g = gastosPorPartida(otros.filter((m) => m.fecha.startsWith(mes)), db.partidas).get(partida.id) || 0;
      return { pres: partida.importe, gastado: r2(g), queda: r2(partida.importe - g), ambito: nombreMes(mes) };
    }
    const año = fecha.slice(0, 4);
    const g = gastosPorPartida(otros.filter((m) => m.fecha.startsWith(año)), db.partidas).get(partida.id) || 0;
    return { pres: anual(partida), gastado: r2(g), queda: r2(anual(partida) - g), ambito: año };
  }, [partida, fecha, db.movimientos, db.partidas, movimiento?.id]);

  // De dónde sale el dinero de un recibo no mensual pagado desde la hucha
  const pagoHucha = useMemo(() => {
    if (tipo !== "gasto" || !partida || esMensual(partida) || negativo || !importe) return null;
    const saldo = ahorradoObjetivo(db, OBJETIVO_FIJO.id) - (movimiento?.enlace ? db.movimientos.find((m) => m.id === movimiento.enlace)?.importe || 0 : 0);
    const deHucha = desdeHucha ? r2(Math.min(importe, Math.max(0, saldo))) : 0;
    return { saldo: r2(saldo), deHucha, deCuenta: r2(importe - deHucha) };
  }, [tipo, partida, negativo, importe, desdeHucha, db, movimiento]);

  async function guardar() {
    if (guardando) return;
    setError("");
    if (!importe) return setError("Escribe un importe con el teclado.");
    if (tipo === "gasto" && !partida) return setError("Elige en qué partida va el gasto.");
    if (tipo === "ahorro" && !objetivoId) return setError("Elige o crea un objetivo de ahorro.");
    const mov = {
      ...(movimiento || {}),
      tipo,
      fecha,
      importe: negativo && tipo !== "ingreso" ? -importe : importe,
      partidaId: tipo === "gasto" ? partidaId : null,
      objetivoId: tipo === "ahorro" ? objetivoId : null,
      concepto: concepto.trim(),
    };
    setGuardando(true);
    try {
      // Antes de guardar: cómo estaban el movimiento y su pareja, para «Deshacer»
      const antes = editando ? db.movimientos.filter((m) => m.id === movimiento.id || (movimiento.enlace && m.id === movimiento.enlace)).map((m) => ({ ...m })) : [];
      const r = tipo === "gasto" ? await acc.guardarGasto(mov, { desdeHucha: Boolean(pagoHucha) && desdeHucha }) : await acc.guardarMovimiento(mov);
      cerrar();
      const otroMes = fecha.slice(0, 7) !== ui.mes ? ` (${nombreMes(fecha.slice(0, 7))})` : "";
      const hucha = r.deHucha ? ` · ${eur(r.deHucha, { corto: true })} de la hucha` : "";
      if (editando) {
        const nuevos = r.enlace && !antes.some((m) => m.id === r.enlace) ? [r.enlace] : [];
        ui.avisar(`Movimiento actualizado${otroMes}${hucha}`, { texto: "Deshacer", fn: () => acc.restaurarMovimientos(antes, nuevos) });
      } else {
        const donde = tipo === "gasto" ? ` en ${nombreCorto(partida.nombre)}` : tipo === "ahorro" ? ` para ${objetivo?.nombre}` : " de ingreso";
        ui.avisar(`${eur(r.importe)}${donde}${otroMes}${hucha}`, { texto: "Deshacer", fn: () => acc.borrarMovimiento(r.id) });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!borrar) return setBorrar(true);
    try {
      // Si iba enlazado (recibo pagado desde la hucha) se borran los dos, y «Deshacer» recupera los dos
      const r = await acc.borrarMovimiento(movimiento.id);
      cerrar();
      const borrados = r?.borrados || [movimiento];
      ui.avisar(borrados.length > 1 ? "Gasto y retirada de la hucha eliminados" : "Movimiento eliminado", {
        texto: "Deshacer",
        fn: () => acc.restaurarMovimientos(borrados),
      });
    } catch (e) {
      setError(e.message);
    }
  }

  // Teclado físico (ordenador)
  const arriba = ui.capas[ui.capas.length - 1]?.tipo === "apuntar";
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;
  useEffect(() => {
    if (!arriba) return;
    const k = (e) => {
      if (e.target.closest?.("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) setValor((v) => aplicarTecla(v, e.key));
      else if (e.key === "," || e.key === ".") setValor((v) => aplicarTecla(v, ","));
      else if (e.key === "Backspace") setValor((v) => aplicarTecla(v, "borrar"));
      else if (e.key === "Enter" && !e.target.closest?.(".apuntar button")) guardarRef.current();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [arriba]);

  function abrirFecha() {
    const i = inputFecha.current;
    if (!i) return;
    try {
      i.showPicker();
    } catch {
      i.focus();
      i.click();
    }
  }

  const elegirPartida = () => ui.abrir("elegirPartida", { fecha, onElegir: (id) => setPartidaId(id) });
  const verbo = tipo === "gasto" ? (negativo ? "Te devuelven" : "Apuntas") : tipo === "ingreso" ? "Recibes" : negativo ? "Retiras" : "Apartas";
  const textoDeslizar = editando ? "Desliza para guardar" : `Desliza para apuntar${importe ? " " + eur(importe, { corto: true }) : ""}`;

  return (
    <div
      className="apuntar"
      role="dialog"
      aria-modal="true"
      aria-label={TITULOS[tipo][editando ? 1 : 0]}
      ref={raiz}
      tabIndex={-1}
      onMouseDown={(e) => {
        // Pulsar fuera de la tarjeta la cierra
        if (e.target === e.currentTarget) return cerrar();
        // Con ratón, los botones no se quedan el foco: así Intro siempre guarda
        if (e.target.closest("button")) e.preventDefault();
      }}
    >
      <div className="apuntar-in">
        <header className="apuntar-cab">
          <button type="button" className="boton-redondo" onClick={cerrar} aria-label="Volver">
            <ChevronLeft size={22} />
          </button>
          <h1>{TITULOS[tipo][editando ? 1 : 0]}</h1>
          {editando ? (
            <button type="button" className={`boton-redondo ${borrar ? "peligro" : ""}`} onClick={eliminar} aria-label={borrar ? "Confirmar eliminar" : "Eliminar"}>
              <Trash2 size={20} />
            </button>
          ) : (
            <button type="button" className="boton-redondo" onClick={abrirFecha} aria-label="Cambiar fecha">
              <CalendarDays size={20} />
            </button>
          )}
        </header>
        {borrar && (
          <p className="apuntar-confirma">
            Pulsa otra vez la papelera para eliminarlo.{" "}
            <button type="button" className="enlace" onClick={() => setBorrar(false)}>
              Cancelar
            </button>
          </p>
        )}

        <Segmentado
          peq
          etiqueta="Tipo de movimiento"
          valor={tipo}
          onCambio={(t) => {
            setTipo(t);
            setNegativo(false);
            setError("");
          }}
          opciones={[
            { valor: "gasto", texto: "Gasto" },
            { valor: "ingreso", texto: "Ingreso" },
            { valor: "ahorro", texto: "Ahorro" },
          ]}
        />

        {/* Fila de accesos rápidos */}
        <div className="avatares" ref={filaRapida} role="listbox" aria-label={tipo === "gasto" ? "Partidas frecuentes" : tipo === "ingreso" ? "Tipo de ingreso" : "Objetivos"}>
          {tipo === "gasto" && (
            <>
              <button type="button" className="avatar-op nuevo" onClick={elegirPartida}>
                <span>
                  <LayoutGrid size={20} />
                </span>
                Todas
              </button>
              {frecuentes.map((p) => (
                <button key={p.id} type="button" role="option" aria-selected={p.id === partidaId} className="avatar-op" onClick={() => setPartidaId(p.id)}>
                  <Ficha icono={p.icono} color={colorCategoria(p.categoria)} size={56} radio={28} />
                  <span className="avatar-op-txt">{nombreCorto(p.nombre)}</span>
                </button>
              ))}
            </>
          )}
          {tipo === "ingreso" &&
            CONCEPTOS_INGRESO.map((c) => (
              <button key={c.texto} type="button" role="option" aria-selected={concepto === c.texto} className="avatar-op" onClick={() => setConcepto(concepto === c.texto ? "" : c.texto)}>
                <Ficha icono={c.icono} color="#c9f36b" size={56} radio={28} />
                <span className="avatar-op-txt">{c.texto}</span>
              </button>
            ))}
          {tipo === "ahorro" && (
            <>
              <button type="button" className="avatar-op nuevo" onClick={() => ui.abrir("objetivo", { onGuardado: (o) => setObjetivoId(o.id) })}>
                <span>
                  <Plus size={20} />
                </span>
                Nuevo
              </button>
              {objetivosConFijo(db).map((o) => (
                <button key={o.id} type="button" role="option" aria-selected={o.id === objetivoId} className="avatar-op" onClick={() => setObjetivoId(o.id)}>
                  <Ficha icono={o.icono} color="#f6a57c" size={56} radio={28} />
                  <span className="avatar-op-txt">{o.nombre}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Tarjeta de lo elegido */}
        {tipo === "gasto" &&
          (partida ? (
            <div className="elegido">
              <Ficha icono={partida.icono} color={colorCategoria(partida.categoria)} size={46} radio={23} />
              <span className="elegido-txt">
                <b>{partida.nombre}</b>
                <small>
                  {partida.categoria}
                  {infoPartida && infoPartida.pres > 0 && ` · llevas ${eur(infoPartida.gastado, { corto: true })} de ${eur(infoPartida.pres, { corto: true })}`}
                </small>
              </span>
              <button type="button" className="chip" onClick={elegirPartida}>
                <ChevronsUpDown size={15} /> Cambiar
              </button>
            </div>
          ) : (
            <button type="button" className="elegido vacio-elegido" onClick={elegirPartida}>
              <span className="elegido-txt">
                <b>Elige una partida</b>
                <small>Toca una de arriba o busca entre todas</small>
              </span>
              <span className="chip">
                <ChevronsUpDown size={15} /> Elegir
              </span>
            </button>
          ))}
        {tipo === "ingreso" && (
          <div className="elegido">
            <Ficha icono="cartera" color="#c9f36b" size={46} radio={23} />
            <span className="elegido-txt">
              <b>Ingreso extra</b>
              <small>Se suma a tu sueldo de {nombreMes(fecha.slice(0, 7))}</small>
            </span>
          </div>
        )}
        {tipo === "ahorro" &&
          (objetivo ? (
            <div className="elegido">
              <Ficha icono={objetivo.icono} color="#f6a57c" size={46} radio={23} />
              <span className="elegido-txt">
                <b>{objetivo.nombre}</b>
                <small>
                  {eur(ahorradoObjetivo(db, objetivo.id), { corto: true })} ahorrados
                  {objetivo.meta > 0 ? ` de ${eur(objetivo.meta, { corto: true })}` : ""}
                </small>
              </span>
            </div>
          ) : (
            <button type="button" className="elegido vacio-elegido" onClick={() => ui.abrir("objetivo", { onGuardado: (o) => setObjetivoId(o.id) })}>
              <span className="elegido-txt">
                <b>Crea un objetivo de ahorro</b>
                <small>El dinero que apartes sale de lo disponible del mes</small>
              </span>
              <span className="chip">
                <Plus size={15} /> Crear
              </span>
            </button>
          ))}

        <div className="apuntar-importe">
          <span className="apuntar-verbo">{verbo}</span>
          <CifraTecleada valor={valor} negativo={false} />
          <div className="pills">
            {tipo === "gasto" && infoPartida && infoPartida.pres > 0 && (
              <span className={`pill ${infoPartida.queda - (negativo ? -importe : importe) < 0 ? "pill-mal" : ""}`}>
                {infoPartida.queda - (negativo ? -importe : importe) < 0 ? "Te pasas" : "Quedarán"}{" "}
                <b>{eur(Math.abs(infoPartida.queda - (negativo ? -importe : importe)))}</b>
              </span>
            )}
            <button type="button" className="pill pill-boton" onClick={abrirFecha}>
              <CalendarDays size={14} /> {fechaRelativa(fecha) === "Hoy" ? `Hoy · ${fechaCorta(fecha)}` : fechaRelativa(fecha)}
            </button>
            {tipo !== "ingreso" && (
              <button type="button" className={`pill pill-boton ${negativo ? "pill-lima" : ""}`} aria-pressed={negativo} onClick={() => setNegativo(!negativo)}>
                <Undo2 size={14} /> {tipo === "gasto" ? "Devolución" : "Retirar"}
              </button>
            )}
            {!verNota && (
              <button type="button" className="pill pill-boton" onClick={() => setVerNota(true)}>
                <PencilLine size={14} /> Nota
              </button>
            )}
            {tipo === "gasto" && !editando && partida?.recibo && importe === 0 && (
              <button type="button" className="pill pill-boton pill-lima" onClick={() => setValor(tecladoDe(partida.importe))}>
                <Zap size={14} /> Recibo {eur(partida.importe, { corto: true })}
              </button>
            )}
          </div>
          {pagoHucha && (
            <div className="pago-hucha">
              <Interruptor activo={desdeHucha} onCambio={setDesdeHucha} etiqueta="Pagar desde la hucha" descripcion={`«Recibos no mensuales» tiene ${eur(Math.max(0, pagoHucha.saldo))}`} />
              <p className={`pago-hucha-reparto ${pagoHucha.deCuenta > 0 && desdeHucha ? "falta" : ""}`}>
                De la hucha {eur(pagoHucha.deHucha, { corto: true })} · de tu cuenta {eur(pagoHucha.deCuenta, { corto: true })}
              </p>
            </div>
          )}
          {verNota && (
            <input
              className="apuntar-nota"
              type="text"
              maxLength={80}
              placeholder={tipo === "gasto" ? "Concepto: Mercadona, Repsol…" : "Concepto (opcional)"}
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
              autoFocus={!editando}
            />
          )}
          <input ref={inputFecha} className="oculto-fecha" type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} tabIndex={-1} aria-label="Fecha" />
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>

        <Teclado onTecla={(t) => setValor((v) => aplicarTecla(v, t))} />
        <Deslizar texto={textoDeslizar} onConfirmar={guardar} desactivado={guardando} />
      </div>
    </div>
  );
}
