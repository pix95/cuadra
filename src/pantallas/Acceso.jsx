// Pantalla para entrar en tu cuenta (modo nube)
import { useState } from "react";
import { useDatos } from "../store.jsx";
import { ICONO } from "../config.js";

export default function Acceso() {
  const { motor } = useDatos();
  const [alta, setAlta] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState({ texto: "", mal: false });
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const mal = (texto) => setMsg({ texto, mal: true });
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return mal("Escribe un email válido.");
    if (pass.length < 6) return mal("La contraseña debe tener al menos 6 caracteres.");
    setOcupado(true);
    setMsg({ texto: "", mal: false });
    try {
      if (alta) {
        const r = await motor.registrar(email.trim(), pass);
        if (r.confirmar) {
          setAlta(false);
          setMsg({ texto: "Te hemos enviado un email. Pulsa el enlace para confirmar la cuenta y luego vuelve aquí y entra.", mal: false });
        }
      } else {
        await motor.entrar(email.trim(), pass);
      }
    } catch (err) {
      mal(err.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="acceso">
      <div className="acceso-in">
        <div className="acceso-marca">
          <img src={ICONO} alt="" width="72" height="72" />
          <h1>
            <em>Cuadra</em>
          </h1>
          <p>Tus gastos frente a tu presupuesto, en el móvil y en el ordenador.</p>
        </div>
        <form onSubmit={enviar} noValidate>
          <label className="campo">
            <span>Email</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="campo">
            <span>Contraseña</span>
            <input type="password" autoComplete={alta ? "new-password" : "current-password"} minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} required />
          </label>
          {msg.texto && (
            <p className={msg.mal ? "error" : "ayuda acceso-ok"} role="status">
              {msg.texto}
            </p>
          )}
          <button type="submit" className="btn btn-primario acceso-boton" disabled={ocupado}>
            {ocupado ? "Un momento…" : alta ? "Crear cuenta" : "Entrar"}
          </button>
          <button
            type="button"
            className="btn btn-texto acceso-boton"
            onClick={() => {
              setAlta(!alta);
              setMsg({ texto: "", mal: false });
            }}
          >
            {alta ? "Ya tengo cuenta: entrar" : "Es la primera vez: crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
