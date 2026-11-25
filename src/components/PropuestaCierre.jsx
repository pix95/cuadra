// "Te sobraron X € el mes pasado: ¿los apartas?"
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useDatos, useUI } from "../store.jsx";
import { propuestaCierre } from "../lib/calculos.js";
import { eur, nombreMes } from "../lib/formato.js";

const clave = (mes) => `cuadra:cierre-descartado:${mes}`;
const descartado = (mes) => {
  try {
    return localStorage.getItem(clave(mes)) === "1";
  } catch {
    return false;
  }
};

export function PropuestaCierre() {
  const { db } = useDatos();
  const ui = useUI();
  const [, refrescar] = useState(0);
  const p = propuestaCierre(db);
  if (!p || descartado(p.mes)) return null;

  function apartar() {
    ui.abrir("cierre", { ...p });
  }
  function ahoraNo() {
    try {
      localStorage.setItem(clave(p.mes), "1");
    } catch {
      /* nada */
    }
    refrescar((n) => n + 1);
  }

  return (
    <section className="tarjeta cierre">
      <div className="cierre-cab">
        <span className="cierre-icono">
          <Sparkles size={20} />
        </span>
        <span>
          <b>Te sobraron {eur(p.importe)} en {nombreMes(p.mes)}</b>
          <small>¿Los apartas a un objetivo de ahorro?</small>
        </span>
      </div>
      <div className="fila-botones">
        <button type="button" className="btn btn-primario" onClick={apartar}>
          Apartarlo
        </button>
        <button type="button" className="btn btn-texto" onClick={ahoraNo}>
          Ahora no
        </button>
      </div>
    </section>
  );
}
