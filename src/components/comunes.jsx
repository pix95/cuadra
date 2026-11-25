// Piezas pequeñas que se usan en varias pantallas.
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Delete, X } from "lucide-react";
import { partes, r2 } from "../lib/formato.js";

// Importe grande con los decimales más apagados: 1.234,56 €
export function Cifra({ valor, signo = false, className = "", sinDecimales = false }) {
  const { neg, entero, dec } = partes(valor);
  const s = neg ? "−" : signo && r2(valor) > 0 ? "+" : "";
  return (
    <span className={`cifra ${className}`}>
      <span className="cifra-ent">
        {s}
        {entero}
      </span>
      <span className="cifra-dec">
        {sinDecimales ? "" : `,${dec}`}
        {" €"}
      </span>
    </span>
  );
}

// Ventana que sube desde abajo
export function Hoja({ titulo, subtitulo, onCerrar, children, pie, className = "" }) {
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    // Si nada de dentro ha cogido el foco (autoFocus), se lo damos a la hoja
    const t = setTimeout(() => {
      if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="hoja-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <section className={`hoja ${className}`} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <div className="hoja-asa" aria-hidden="true" />
        <header className="hoja-cab">
          <div>
            <h2 id={id}>{titulo}</h2>
            {subtitulo && <p className="hoja-sub">{subtitulo}</p>}
          </div>
          <button type="button" className="boton-redondo peq" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="hoja-cuerpo">{children}</div>
        {pie && <footer className="hoja-pie">{pie}</footer>}
      </section>
    </div>
  );
}

// Teclado numérico
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "borrar"];
export function Teclado({ onTecla }) {
  return (
    <div className="teclado">
      {TECLAS.map((t) => (
        <button
          key={t}
          type="button"
          className="tecla"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onTecla(t)}
          aria-label={t === "borrar" ? "Borrar" : t}
        >
          {t === "borrar" ? <Delete size={24} strokeWidth={1.8} /> : t}
        </button>
      ))}
    </div>
  );
}

export function aplicarTecla(valor, t) {
  if (t === "borrar") return valor.slice(0, -1);
  if (t === ",") return valor.includes(",") ? valor : (valor || "0") + ",";
  if (!/^\d$/.test(t)) return valor;
  const [ent, dec] = valor.split(",");
  if (dec !== undefined) return dec.length >= 2 ? valor : valor + t;
  if (ent === "0") return t;
  if (ent.length >= 7) return valor;
  return valor + t;
}
export const valorTeclado = (v) => (v ? Number(v.replace(",", ".")) || 0 : 0);
export const tecladoDe = (n) => {
  if (!n) return "";
  const v = r2(Math.abs(n));
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",").replace(/0$/, "");
};

// Importe tal y como se teclea, con el resto de decimales en gris
export function CifraTecleada({ valor, negativo }) {
  const [ent = "", dec] = valor.split(",");
  const entero = (ent || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const escritos = dec ?? "";
  const faltan = "00".slice(escritos.length);
  return (
    <span className={`cifra cifra-tecleada ${valor ? "" : "vacia"}`}>
      <span className="cifra-ent">
        {negativo ? "−" : ""}
        {entero}
        {dec !== undefined ? "," + escritos : ""}
      </span>
      <span className="cifra-dec">
        {dec === undefined ? ",00" : faltan}
        {" €"}
      </span>
      <span className="cursor" aria-hidden="true" />
    </span>
  );
}

// Botón de deslizar para confirmar
export function Deslizar({ texto, onConfirmar, desactivado = false }) {
  const pista = useRef(null);
  const [x, setX] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const inicio = useRef(0);
  const POMO = 60;
  const max = () => (pista.current ? pista.current.clientWidth - POMO - 12 : 0);

  function bajar(e) {
    if (desactivado) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    inicio.current = e.clientX - x;
    setArrastrando(true);
  }
  function mover(e) {
    if (!arrastrando) return;
    setX(Math.max(0, Math.min(max(), e.clientX - inicio.current)));
  }
  function soltar() {
    if (!arrastrando) return;
    setArrastrando(false);
    if (x >= max() * 0.82) {
      setX(max());
      onConfirmar();
      setTimeout(() => setX(0), 450);
    } else setX(0);
  }
  const avance = max() ? x / max() : 0;
  return (
    <div className={`deslizar ${desactivado ? "off" : ""}`} ref={pista}>
      <span className="deslizar-txt" style={{ opacity: 1 - avance * 0.9 }}>
        {texto}
      </span>
      <span className="deslizar-flechas" aria-hidden="true" style={{ opacity: 1 - avance }}>
        <ChevronRight size={16} />
        <ChevronRight size={16} />
        <ChevronRight size={16} />
      </span>
      <button
        type="button"
        className="deslizar-pomo"
        style={{ transform: `translateX(${x}px)`, transition: arrastrando ? "none" : "transform .3s cubic-bezier(.3,1.3,.5,1)" }}
        onPointerDown={bajar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !desactivado) {
            e.preventDefault();
            onConfirmar();
          }
        }}
        aria-label={`${texto} (o pulsa Intro)`}
        aria-disabled={desactivado}
      >
        <ArrowRight size={22} />
      </button>
    </div>
  );
}

// Selector segmentado tipo "Semana | Mes | Año"
export function Segmentado({ opciones, valor, onCambio, peq = false, etiqueta }) {
  return (
    <div className={`segmentado ${peq ? "peq" : ""}`} role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" role="tab" aria-selected={o.valor === valor} onClick={() => onCambio(o.valor)}>
          {o.icono}
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Interruptor({ activo, onCambio, etiqueta, descripcion }) {
  return (
    <label className="interruptor">
      <span>
        <b>{etiqueta}</b>
        {descripcion && <small>{descripcion}</small>}
      </span>
      <input type="checkbox" role="switch" checked={activo} onChange={(e) => onCambio(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

// ‹ Noviembre 2026 ›
export function Navegador({ texto, onAnterior, onSiguiente, onTexto, tituloTexto }) {
  return (
    <div className="navegador">
      <button type="button" className="boton-redondo peq" onClick={onAnterior} aria-label="Anterior">
        <ChevronLeft size={18} />
      </button>
      <button type="button" className="navegador-txt" onClick={onTexto} title={tituloTexto}>
        {texto}
      </button>
      <button type="button" className="boton-redondo peq" onClick={onSiguiente} aria-label="Siguiente">
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// Línea de la tarjeta de saldo
export function Sparkline({ valores, ancho = 150, alto = 56 }) {
  const id = useId().replace(/:/g, "");
  const v = valores.length > 1 ? valores : [valores[0] ?? 0, valores[0] ?? 0];
  const min = Math.min(...v);
  const max = Math.max(...v);
  const rango = max - min;
  const pad = 6;
  // Sin cambios en el mes, la línea va por el centro
  const yDe = (y) => (rango ? pad + (1 - (y - min) / rango) * (alto - pad * 2) : alto / 2);
  const pts = v.map((y, i) => [pad + (i / (v.length - 1)) * (ancho - pad * 2), yDe(y)]);
  // Curva suave
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const [ux, uy] = pts[pts.length - 1];
  return (
    <svg className="sparkline" viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} aria-hidden="true">
      <defs>
        <linearGradient id={`sl${id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={ancho} y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke={`url(#sl${id})`} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={ux} cy={uy} r="7" fill="#e8ff9a" opacity=".25" />
      <circle cx={ux} cy={uy} r="3.6" fill="#e8ff9a" />
    </svg>
  );
}

// Anillo de porcentaje
export function Anillo({ pct, tam = 104, grosor = 9, children, peligro = false }) {
  const id = useId().replace(/:/g, "");
  const r = (tam - grosor) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="anillo" style={{ width: tam, height: tam }}>
      <svg viewBox={`0 0 ${tam} ${tam}`} width={tam} height={tam} aria-hidden="true">
        <defs>
          <linearGradient id={`an${id}`} x1="0" y1="0" x2="1" y2="1">
            {peligro ? (
              <>
                <stop offset="0" stopColor="#ff9a7a" />
                <stop offset="1" stopColor="#ff5f7e" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#f6a57c" />
                <stop offset=".5" stopColor="#e277b4" />
                <stop offset="1" stopColor="#a463d6" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={grosor} />
        <circle
          cx={tam / 2}
          cy={tam / 2}
          r={r}
          fill="none"
          stroke={`url(#an${id})`}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`}
          transform={`rotate(-90 ${tam / 2} ${tam / 2})`}
          style={{ transition: "stroke-dasharray .6s ease" }}
        />
      </svg>
      <div className="anillo-centro">{children}</div>
    </div>
  );
}

// Barra de progreso con la marca de "hoy"
export function Barra({ pct, estado = "ok", marca = null, color, alta = false }) {
  return (
    <span className={`barra ${alta ? "alta" : ""}`} data-estado={estado}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, ...(color ? { "--c": color } : {}) }} />
      {marca != null && <b className="barra-marca" style={{ left: `${marca}%` }} />}
    </span>
  );
}

// Barra a rayas (como la del objetivo de ahorro)
export function BarraRayas({ pct, n = 34 }) {
  const llenas = Math.round((Math.max(0, Math.min(100, pct)) / 100) * n);
  return (
    <div className="rayas" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={i < llenas ? "llena" : ""} style={i < llenas ? { "--t": n > 1 ? i / (n - 1) : 0 } : undefined} />
      ))}
    </div>
  );
}

export function Vacio({ titulo, children, icono }) {
  return (
    <div className="vacio">
      {icono}
      <strong>{titulo}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

// Campo de importe con teclado del sistema (para formularios)
export function CampoImporte({ valor, onCambio, etiqueta, placeholder = "0,00", grande = false, autoFocus = false, id }) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus) setTimeout(() => ref.current?.focus(), 60);
  }, [autoFocus]);
  return (
    <label className={`campo ${grande ? "campo-grande" : ""}`} htmlFor={id}>
      {etiqueta && <span>{etiqueta}</span>}
      <span className="campo-importe">
        <input
          id={id}
          ref={ref}
          aria-label={etiqueta}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          placeholder={placeholder}
          onChange={(e) => onCambio(e.target.value.replace(/[^\d,.-]/g, ""))}
        />
        <em>€</em>
      </span>
    </label>
  );
}
