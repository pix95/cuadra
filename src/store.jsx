// Estado de la app: los datos (del motor elegido en src/config.js) y el estado
// de la interfaz (pestaña, mes elegido, ventanas abiertas y avisos).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { motor } from "./motores/index.js";
import { mesActual } from "./lib/formato.js";

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

const VISTAS = ["inicio", "movimientos", "analisis", "presupuesto", "ahorros", "simulador"];
const vistaDeHash = () => {
  const v = location.hash.replace(/^#\/?/, "");
  return VISTAS.includes(v) ? v : "inicio";
};

export function UIProvider({ children }) {
  const [vista, setVista] = useState(vistaDeHash);
  const [mes, setMes] = useState(mesActual);
  const [capas, setCapas] = useState([]); // ventanas abiertas, la última encima
  const [aviso, setAviso] = useState(null);
  const [extra, setExtra] = useState({}); // datos de paso entre pantallas (p. ej. buscar)
  const timer = useRef(null);
  const n = useRef(0);

  useEffect(() => {
    const f = () => {
      setVista(vistaDeHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const irA = useCallback((v, datos = {}) => {
    setExtra(datos);
    if (location.hash !== `#/${v}`) location.hash = `/${v}`;
    setVista(v);
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
    () => ({ vista, irA, mes, setMes, capas, abrir, cerrar, aviso, avisar, quitarAviso, extra }),
    [vista, irA, mes, capas, abrir, cerrar, aviso, avisar, quitarAviso, extra]
  );
  return <UICtx.Provider value={valor}>{children}</UICtx.Provider>;
}

export const useUI = () => useContext(UICtx);
