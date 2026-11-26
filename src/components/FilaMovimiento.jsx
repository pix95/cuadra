import { Ficha } from "../lib/iconos.jsx";
import { colorCategoria } from "../lib/iconos.jsx";
import { eur, fechaRelativa, nombreMes } from "../lib/formato.js";
import { objetivosConFijo, cuentas, cuentaDeAjuste, esAjuste } from "../lib/calculos.js";

const ESTADO = {
  gasto: (m) => (m.importe < 0 ? "Devolución" : "Gasto"),
  ingreso: () => "Ingreso",
  ahorro: (m) => (m.importe < 0 ? "Retirada" : "Ahorro"),
  ajuste: () => "Ajuste",
  inicial: () => "Ajuste",
};

export function describirMovimiento(m, db) {
  // Ajuste de una cuenta («Cuadrar con el banco», o un «inicial» antiguo)
  if (esAjuste(m)) {
    const cuenta = cuentas(db).find((c) => c.id === cuentaDeAjuste(m));
    return { p: null, o: cuenta, titulo: m.concepto || "Ajuste", sub: cuenta?.nombre || "Cuenta eliminada", icono: "ajuste", color: "#8fa2ff", valor: m.importe };
  }
  const p = m.tipo === "gasto" ? db.partidas.find((x) => x.id === m.partidaId) : null;
  const o = m.tipo === "ahorro" ? objetivosConFijo(db).find((x) => x.id === m.objetivoId) : null;
  const nombreBase = p ? p.nombre : o ? o.nombre : m.tipo === "ingreso" ? "Ingreso extra" : m.tipo === "ahorro" ? "Ahorro" : "Sin partida";
  const titulo = m.concepto || nombreBase;
  const sub = m.concepto ? nombreBase : p ? p.categoria : m.tipo === "ahorro" ? "Objetivo de ahorro" : "";
  const icono = p ? p.icono : o ? o.icono : m.tipo === "ingreso" ? "cartera" : m.tipo === "ahorro" ? "hucha" : "paquete";
  const color = p ? colorCategoria(p.categoria) : m.tipo === "ingreso" ? "#c9f36b" : m.tipo === "ahorro" ? "#f6a57c" : "#8a818e";
  const valor = m.tipo === "ingreso" ? m.importe : -m.importe;
  return { p, o, titulo, sub, icono, color, valor };
}

export function FilaMovimiento({ m, db, onClick, conFecha = true }) {
  const d = describirMovimiento(m, db);
  return (
    <button type="button" className="fila-mov" onClick={onClick}>
      <Ficha icono={d.icono} color={d.color} size={46} />
      <span className="fila-mov-txt">
        <b>{d.titulo}</b>
        <small>{[d.sub, conFecha && fechaRelativa(m.fecha), m.mes && `cuenta para ${nombreMes(m.mes)}`].filter(Boolean).join(" · ")}</small>
      </span>
      <span className="fila-mov-imp">
        <b className={d.valor > 0 ? "positivo" : ""}>{eur(d.valor, { signo: true })}</b>
        <small>{ESTADO[m.tipo]?.(m)}</small>
      </span>
    </button>
  );
}

export const ordenarMovs = (movs) =>
  [...movs].sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.creado || "").localeCompare(String(a.creado || "")));
