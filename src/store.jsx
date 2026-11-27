// Estado de la app: los datos (del motor elegido en src/config.js) y el estado
// de la interfaz (pestaña, mes elegido, ventanas abiertas y avisos).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { motor } from "./motores/index.js";
import { mesEnCurso } from "./lib/calculos.js";

const DatosCtx = createContext(null);
const UICtx = createContext(null);

export function DatosProvider({ children }) {
  const [db, setDb] = useState(null);
  const [sesion, setSesion] = useState(undefined); // undefined = comprobando
  const [sync, setSync] = useState({ estado: "ok", pendientes: 0 });
  const [avisoMotor, setAvisoMotor] = useState(null);

  useEffect(() => {
    motor.arrancar({ estado: setDb, sesion: setSesion, sync: setSync, aviso: setAvisoMotor });
  }, []);

  const acc = useMemo(() => ({ ...motor, recargar: () => motor.sincronizar() }), []);
  const error = !db && sync.estado === "error" ? sync.error : null;
  const valor = useMemo(() => ({ db, error, acc, sesion, sync, motor, avisoMotor, setAvisoMotor }), [db, error, acc, sesion, sync, avisoMotor]);
  return <DatosCtx.Provider value={valor}>{children}</DatosCtx.Provider>;
}

export const useDatos = () => useContext(DatosCtx);

const VISTAS = ["inicio", "movimientos", "analisis", "presupuesto", "ahorros", "simulador", "coche", "areas"];
// "#/areas/Vivienda" → vista "areas" con sub "Vivienda"; "#/coche/<id>" → ese vehículo
const leerHash = () => {
  const [v, ...resto] = location.hash.replace(/^#\/?/, "").split("/");
  if (!VISTAS.includes(v)) return { vista: "inicio", sub: null };
  let sub = null;
  try {
    sub = resto.length && resto.join("/") ? decodeURIComponent(resto.join("/")) : null;
  } catch {
    sub = null;
  }
  return { vista: v, sub };
};

export function UIProvider({ children }) {
  const { db } = useContext(DatosCtx);
  const [ruta, setRuta] = useState(leerHash);
  const { vista, sub } = ruta;
  // Al abrir, el mes que estás viviendo (diciembre el 30 de noviembre si ya has ingresado su nómina)
  const [mes, setMes] = useState(() => mesEnCurso(db));
  const [capas, setCapas] = useState([]); // ventanas abiertas, la última encima
  const [aviso, setAviso] = useState(null);
  const [extra, setExtra] = useState({}); // datos de paso entre pantallas (p. ej. buscar)
  const timer = useRef(null);
  const n = useRef(0);

  useEffect(() => {
    const f = () => {
      setRuta(leerHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  // irA("areas", {}, "Vivienda") abre la página de un área (o de un vehículo, con "coche")
  const irA = useCallback((v, datos = {}, subRuta = null) => {
    setExtra(datos);
    const h = `/${v}${subRuta ? `/${encodeURIComponent(subRuta)}` : ""}`;
    if (location.hash !== `#${h}`) location.hash = h;
    setRuta({ vista: v, sub: subRuta });
    window.scrollTo(0, 0);
  }, []);

  const abrir = useCallback((tipo, props = {}) => setCapas((c) => [...c, { id: ++n.current, tipo, props }]), []);
  const cerrar = useCallback((id) => setCapas((c) => (id == null ? c.slice(0, -1) : c.filter((x) => x.id !== id))), []);

  const avisar = useCallback((texto, accion = null, nivel = "ok") => {
    clearTimeout(timer.current);
    setAviso({ texto, accion, nivel, id: Date.now() });
    timer.current = setTimeout(() => setAviso(null), accion ? 6000 : 3000);
  }, []);
  const quitarAviso = useCallback(() => setAviso(null), []);

  const valor = useMemo(
    () => ({ vista, sub, irA, mes, setMes, capas, abrir, cerrar, aviso, avisar, quitarAviso, extra }),
    [vista, sub, irA, mes, capas, abrir, cerrar, aviso, avisar, quitarAviso, extra]
  );
  return <UICtx.Provider value={valor}>{children}</UICtx.Provider>;
}

export const useUI = () => useContext(UICtx);
