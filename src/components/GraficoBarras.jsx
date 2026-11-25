import { useEffect, useState } from "react";
import { eur } from "../lib/formato.js";

// Gráfico de barras con la media en línea discontinua y una barra destacada.
// datos: [{ clave, valor, futuro, etiqueta, titulo }]
export function GraficoBarras({ datos, media, etiquetas, alto = 150 }) {
  const maxIdx = datos.reduce((best, d, i) => (d.valor > (datos[best]?.valor ?? -Infinity) ? i : best), 0);
  const [sel, setSel] = useState(maxIdx);
  const firma = datos.map((d) => d.clave).join();
  useEffect(() => setSel(maxIdx), [firma, maxIdx]);

  const max = Math.max(...datos.map((d) => d.valor), media || 0, 1);
  const elegido = datos[sel];
  const hayDatos = datos.some((d) => d.valor > 0);

  return (
    <div className="grafico" style={{ "--alto": `${alto}px` }}>
      <div className="grafico-zona">
        {media > 0 && <div className="grafico-media" style={{ bottom: `${(media / max) * 100}%` }} />}
        {datos.map((d, i) => {
          const h = d.valor > 0 ? Math.max(4, (d.valor / max) * 100) : 2;
          const activa = i === sel && hayDatos;
          return (
            <button
              key={d.clave}
              type="button"
              className={`grafico-barra ${activa ? "activa" : ""} ${d.futuro ? "futuro" : ""}`}
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              aria-label={`${d.titulo}: ${eur(d.valor)}`}
            >
              <i style={{ height: `${h}%` }} />
              {activa && (
                <span
                  className={`grafico-tip ${i < datos.length * 0.15 ? "izq" : i > datos.length * 0.85 - 1 ? "der" : ""}`}
                  style={{ bottom: `calc(${h}% + 10px)` }}
                >
                  <small>{d.titulo}</small> {eur(d.valor, { corto: true })}
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
      {!hayDatos && elegido && <p className="grafico-vacio">Sin gastos en este periodo</p>}
    </div>
  );
}
