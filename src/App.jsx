import { useEffect, useRef } from "react";
import { House, ReceiptText, ChartColumnBig, Wallet, PiggyBank, FlaskConical, RotateCcw } from "lucide-react";
import { useDatos, useUI, UIProvider } from "./store.jsx";
import { mesActual } from "./lib/formato.js";
import { ICONO } from "./config.js";
import Inicio from "./pantallas/Inicio.jsx";
import Movimientos from "./pantallas/Movimientos.jsx";
import Analisis from "./pantallas/Analisis.jsx";
import Presupuesto from "./pantallas/Presupuesto.jsx";
import Simulador from "./pantallas/Simulador.jsx";
import Ahorros from "./pantallas/Ahorros.jsx";
import Apuntar from "./pantallas/Apuntar.jsx";
import Acceso from "./pantallas/Acceso.jsx";
import { HojaCierre, HojaSueldo, HojaPartida, HojaObjetivo, HojaAlertas, HojaRecibos, HojaAjustes, HojaElegirPartida, HojaMeses, HojaConfirmar } from "./pantallas/Hojas.jsx";

const PANTALLAS = { inicio: Inicio, movimientos: Movimientos, analisis: Analisis, presupuesto: Presupuesto, ahorros: Ahorros, simulador: Simulador };
const CAPAS = {
  apuntar: Apuntar,
  sueldo: HojaSueldo,
  partida: HojaPartida,
  objetivo: HojaObjetivo,
  alertas: HojaAlertas,
  recibos: HojaRecibos,
  ajustes: HojaAjustes,
  elegirPartida: HojaElegirPartida,
  meses: HojaMeses,
  confirmar: HojaConfirmar,
  cierre: HojaCierre,
};

const PESTAÑAS = [
  { id: "inicio", texto: "Inicio", Icono: House },
  { id: "movimientos", texto: "Historial", Icono: ReceiptText },
  { id: "analisis", texto: "Análisis", Icono: ChartColumnBig },
  { id: "presupuesto", texto: "Presupuesto", Icono: Wallet },
  { id: "ahorros", texto: "Ahorros", Icono: PiggyBank },
  { id: "simulador", texto: "Simular", Icono: FlaskConical },
];

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

  // Al empezar un mes nuevo, pregunta con qué sueldo empiezas
  const preguntado = useRef(false);
  useEffect(() => {
    if (preguntado.current) return;
    preguntado.current = true;
    const mes = mesActual();
    let pospuesto = false;
    try {
      pospuesto = sessionStorage.getItem(`cuadra:sueldo-pospuesto:${mes}`) === "1";
    } catch {
      /* sin almacenamiento */
    }
    if (db.meses[mes]?.sueldo == null && !pospuesto) ui.abrir("sueldo", { mes, inicioDeMes: true });
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

  return (
    <div className="marco">
      <main className="pantalla" key={ui.vista} aria-hidden={ui.capas.length > 0 || undefined}>
        <Pantalla />
      </main>

      <nav className="nav" aria-label="Secciones">
        {PESTAÑAS.map(({ id, texto, Icono }) => (
          <button
            key={id}
            type="button"
            className="nav-item"
            aria-current={ui.vista === id ? "page" : undefined}
            onClick={() => ui.irA(id)}
            aria-label={texto}
            title={texto}
          >
            <Icono size={21} strokeWidth={1.9} />
            <span>{texto}</span>
          </button>
        ))}
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
                ui.aviso.accion.fn();
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
