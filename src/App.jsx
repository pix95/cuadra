import { useEffect, useRef } from "react";
import { House, ReceiptText, Wallet, Wrench, RotateCcw } from "lucide-react";
import { Segmentado } from "./components/comunes.jsx";
import Coche from "./pantallas/Coche.jsx";
import Areas from "./pantallas/Areas.jsx";
import { HojaVehiculo, HojaRepostaje, HojaMantenimiento, HojaRecordatorio } from "./pantallas/CocheHojas.jsx";
import { useDatos, useUI, UIProvider } from "./store.jsx";
import { mesEnCurso } from "./lib/calculos.js";
import { ICONO } from "./config.js";
import Inicio from "./pantallas/Inicio.jsx";
import Movimientos from "./pantallas/Movimientos.jsx";
import Analisis from "./pantallas/Analisis.jsx";
import Presupuesto from "./pantallas/Presupuesto.jsx";
import Simulador from "./pantallas/Simulador.jsx";
import Ahorros, { HojaHucha } from "./pantallas/Ahorros.jsx";
import Apuntar from "./pantallas/Apuntar.jsx";
import Acceso from "./pantallas/Acceso.jsx";
import { HojaNomina, HojaConfigNomina } from "./pantallas/Nomina.jsx";
import { HojaEmpezarDeCero, HojaCuadrar, HojaAjuste, HojaCierre, HojaSueldo, HojaPartida, HojaObjetivo, HojaAlertas, HojaRecibos, HojaAjustes, HojaElegirPartida, HojaMeses, HojaConfirmar } from "./pantallas/Hojas.jsx";

const PANTALLAS = { inicio: Inicio, movimientos: Movimientos, analisis: Analisis, presupuesto: Presupuesto, ahorros: Ahorros, simulador: Simulador, coche: Coche, areas: Areas };
const CAPAS = {
  apuntar: Apuntar,
  sueldo: HojaSueldo,
  nomina: HojaNomina,
  nominaAjustes: HojaConfigNomina,
  partida: HojaPartida,
  objetivo: HojaObjetivo,
  alertas: HojaAlertas,
  recibos: HojaRecibos,
  ajustes: HojaAjustes,
  elegirPartida: HojaElegirPartida,
  meses: HojaMeses,
  confirmar: HojaConfirmar,
  cierre: HojaCierre,
  hucha: HojaHucha,
  cuadrar: HojaCuadrar,
  ajuste: HojaAjuste,
  empezarDeCero: HojaEmpezarDeCero,
  vehiculo: HojaVehiculo,
  repostaje: HojaRepostaje,
  mantenimiento: HojaMantenimiento,
  recordatorio: HojaRecordatorio,
};

// Cuatro pestañas; las tres últimas agrupan dos pantallas con un selector arriba
const PESTAÑAS = [
  { id: "inicio", texto: "Inicio", Icono: House, vistas: [["inicio", "Inicio"]] },
  { id: "dinero", texto: "Mi dinero", Icono: Wallet, vistas: [["presupuesto", "Presupuesto"], ["ahorros", "Ahorros"]] },
  { id: "movs", texto: "Movimientos", Icono: ReceiptText, vistas: [["movimientos", "Historial"], ["analisis", "Análisis"]] },
  // El coche se abre dentro de Áreas (Transporte)
  { id: "herramientas", texto: "Herramientas", Icono: Wrench, vistas: [["areas", "Áreas"], ["simulador", "Simular"]], alias: { coche: "areas" } },
];
const pestañaDe = (vista) => PESTAÑAS.find((p) => p.vistas.some(([v]) => v === vista) || p.alias?.[vista]) || PESTAÑAS[0];
const vistaDePestaña = (p, vista) => p.alias?.[vista] || vista;
// La última pantalla abierta de cada pestaña
function ultimaVista(p) {
  try {
    const v = localStorage.getItem(`cuadra:pestaña:${p.id}`);
    if (p.vistas.some(([x]) => x === v)) return v;
  } catch {
    /* sin almacenamiento */
  }
  return p.vistas[0][0];
}
function recordarVista(vista) {
  const p = pestañaDe(vista);
  if (p.vistas.length < 2) return;
  try {
    localStorage.setItem(`cuadra:pestaña:${p.id}`, vistaDePestaña(p, vista));
  } catch {
    /* sin almacenamiento */
  }
}

export default function App() {
  const { db, error, acc, sesion, motor, sync } = useDatos();
  if (motor.necesitaCuenta && sesion === null) return <Acceso />;
  if (!db) {
    const offline = sync.estado === "offline";
    return (
      <div className="arranque">
        <img src={ICONO} alt="" width="64" height="64" />
        {error || offline ? (
          <>
            <strong>{motor.tipo === "servidor" ? "No puedo conectar con el servidor" : offline ? "Sin conexión" : "No se han podido cargar tus datos"}</strong>
            <p>
              {offline
                ? "Necesitas internet la primera vez que entras en este dispositivo."
                : motor.tipo === "servidor"
                  ? `${error} Comprueba que Cuadra está arrancada (npm run app o npm start).`
                  : error}
            </p>
            <button type="button" className="btn btn-primario" onClick={acc.recargar}>
              <RotateCcw size={18} /> Reintentar
            </button>
            {motor.necesitaCuenta && (
              <button type="button" className="btn btn-texto" onClick={() => motor.salir()}>
                Cerrar sesión
              </button>
            )}
          </>
        ) : (
          <p>{sesion === undefined ? "Abriendo Cuadra…" : "Cargando tus cuentas…"}</p>
        )}
      </div>
    );
  }
  return (
    <UIProvider>
      <Marco />
    </UIProvider>
  );
}

function Marco() {
  const { db, avisoMotor, setAvisoMotor } = useDatos();
  const ui = useUI();
  const Pantalla = PANTALLAS[ui.vista] || Inicio;

  // Al empezar un mes sin nómina, propone ingresarla
  const preguntado = useRef(false);
  useEffect(() => {
    if (preguntado.current) return;
    preguntado.current = true;
    const mes = mesEnCurso(db);
    let pospuesto = false;
    try {
      pospuesto = sessionStorage.getItem(`cuadra:sueldo-pospuesto:${mes}`) === "1";
    } catch {
      /* sin almacenamiento */
    }
    if (db.meses[mes]?.sueldo == null && !pospuesto) ui.abrir("nomina", { mes, inicioDeMes: true });
    // Solo al abrir la app
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Avisos que llegan del guardado en la nube y de una versión nueva de la app
  useEffect(() => {
    if (avisoMotor) {
      ui.avisar(avisoMotor, null, "mal");
      setAvisoMotor(null);
    }
  }, [avisoMotor, setAvisoMotor, ui]);
  useEffect(() => {
    const f = () => ui.avisar("Hay una versión nueva de Cuadra", { texto: "Recargar", fn: () => location.reload() });
    window.addEventListener("cuadra:nueva-version", f);
    return () => window.removeEventListener("cuadra:nueva-version", f);
  }, [ui]);

  // Escape cierra la ventana de arriba; sin ventanas, el fondo no se desplaza
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape" && ui.capas.length) ui.cerrar();
    };
    window.addEventListener("keydown", k);
    document.body.classList.toggle("bloqueado", ui.capas.length > 0);
    return () => window.removeEventListener("keydown", k);
  }, [ui.capas.length, ui]);

  const pestaña = pestañaDe(ui.vista);
  useEffect(() => recordarVista(ui.vista), [ui.vista]);

  return (
    <div className="marco">
      <main className="pantalla" key={`${ui.vista}/${ui.sub || ""}`} aria-hidden={ui.capas.length > 0 || undefined}>
        {pestaña.vistas.length > 1 && (
          <div className="selector-pestaña">
            <Segmentado peq etiqueta={pestaña.texto} valor={vistaDePestaña(pestaña, ui.vista)} onCambio={(v) => ui.irA(v)} opciones={pestaña.vistas.map(([valor, texto]) => ({ valor, texto }))} />
          </div>
        )}
        <Pantalla />
      </main>

      <nav className="nav" aria-label="Secciones">
        <div className="nav-marca" aria-hidden="true">
          <img src={ICONO} alt="" width="34" height="34" />
          <b>Cuadra</b>
        </div>
        {PESTAÑAS.map((p) => {
          const { id, texto, Icono } = p;
          return (
          <button
            key={id}
            type="button"
            className="nav-item"
            aria-current={pestaña.id === id ? "page" : undefined}
            onClick={() => ui.irA(pestaña.id === id ? vistaDePestaña(p, ui.vista) : ultimaVista(p))}
            aria-label={texto}
            title={texto}
          >
            <Icono size={21} strokeWidth={1.9} />
            <span>{texto}</span>
          </button>
          );
        })}
      </nav>

      {ui.capas.map((c) => {
        const C = CAPAS[c.tipo];
        return C ? <C key={c.id} {...c.props} cerrar={() => ui.cerrar(c.id)} /> : null;
      })}

      {ui.aviso && (
        <div className="aviso" data-nivel={ui.aviso.nivel} role="status" key={ui.aviso.id}>
          <span>{ui.aviso.texto}</span>
          {ui.aviso.accion && (
            <button
              type="button"
              onClick={() => {
                ui.quitarAviso();
                // Si «Deshacer» falla, que se vea
                Promise.resolve()
                  .then(ui.aviso.accion.fn)
                  .catch((e) => ui.avisar(e.message, null, "mal"));
              }}
            >
              {ui.aviso.accion.texto}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
