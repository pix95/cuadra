import { useEffect, useState } from "react";
import { eur } from "../lib/formato.js";

// Gráfico de barras con la media en línea discontinua y una barra destacada.
// datos: [{ clave, valor, futuro, etiqueta, titulo }]. formato: cómo se escribe
// un valor (euros por defecto; el coche lo usa con l/100 km y €/l).
const enEuros = (v) => eur(v, { corto: true });
export function GraficoBarras({ datos, media, etiquetas, alto = 150, vacio = "Sin gastos en este periodo", formato = enEuros, minimo = 0 }) {
  const maxIdx = datos.reduce((best, d, i) => (d.valor > (datos[best]?.valor ?? -Infinity) ? i : best), 0);
  const [sel, setSel] = useState(maxIdx);
  const firma = datos.map((d) => d.clave).join();
  useEffect(() => setSel(maxIdx), [firma, maxIdx]);

  // "minimo": las barras empiezan en ese valor (para que se noten las diferencias)
  const max = Math.max(...datos.map((d) => d.valor), media || 0, minimo ? minimo + 0.001 : 1) - minimo;
  const alt = (v) => ((v - minimo) / max) * 100;
  const elegido = datos[sel];
  const hayDatos = datos.some((d) => d.valor > 0);

  return (
    <div className="grafico" style={{ "--alto": `${alto}px` }}>
      <div className="grafico-zona">
        {media > 0 && <div className="grafico-media" style={{ bottom: `${alt(media)}%` }} />}
        {datos.map((d, i) => {
          const h = d.valor > 0 ? Math.max(4, alt(d.valor)) : 2;
          const activa = i === sel && hayDatos;
          return (
            <button
              key={d.clave}
              type="button"
              className={`grafico-barra ${activa ? "activa" : ""} ${d.futuro ? "futuro" : ""}`}
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              aria-label={`${d.titulo}: ${formato(d.valor)}`}
            >
              <i style={{ height: `${h}%` }} />
              {activa && (
                <span
                  className={`grafico-tip ${i < datos.length * 0.15 ? "izq" : i > datos.length * 0.85 - 1 ? "der" : ""}`}
                  style={{ bottom: `calc(${h}% + 10px)` }}
                >
                  <small>{d.titulo}</small> {formato(d.valor)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="grafico-ejes" aria-hidden="true">
        {datos.map((d, i) => (
          <span key={d.clave}>{etiquetas(d, i)}</span>
        ))}
      </div>
      {!hayDatos && elegido && <p className="grafico-vacio">{vacio}</p>}
    </div>
  );
}
