// Modo nube: los datos viven en Supabase y una copia en el dispositivo.
// Todo se guarda primero aquí (funciona sin conexión) y los cambios se envían
// en cola cuando hay internet. Al abrir la app o volver a ella se descarga lo
// último, así lo que apuntas en el móvil aparece en el ordenador.
import { createClient } from "@supabase/supabase-js";
import { op, migrar, semilla, normalizarPartida } from "../../shared/modelo.js";
import { importarCSV } from "../../shared/csv.js";
import inicial from "../../presupuesto-inicial.js";

const CONFLICTO = { partidas: "id", movimientos: "id", objetivos: "id", simulaciones: "id", meses: "user_id,mes", ajustes: "user_id" };

// ---------- De la app a Supabase y al revés ----------
const aFila = {
  partidas: (p) => ({
    id: p.id, nombre: p.nombre, categoria: p.categoria, importe: p.importe, frecuencia: p.frecuencia, orden: Math.round(p.orden),
    activa: p.activa, recibo: p.recibo, icono: p.icono, cobro_ancla: p.cobroAncla ?? null,
  }),
  movimientos: (m) => ({
    id: m.id, tipo: m.tipo, fecha: m.fecha, importe: m.importe, partida_id: m.partidaId, objetivo_id: m.objetivoId,
    concepto: m.concepto, creado: m.creado, enlace: m.enlace ?? null,
  }),
  meses: (x) => ({ mes: x.mes, sueldo: x.sueldo }),
  objetivos: (o) => ({ id: o.id, nombre: o.nombre, meta: o.meta, fecha: o.fecha, icono: o.icono, creado: o.creado }),
  simulaciones: (s) => ({
    id: s.id,
    nombre: s.nombre,
    datos: { sueldo: s.sueldo, ingresosExtra: s.ingresosExtra, partidas: s.partidas, extras: s.extras, nota: s.nota },
    creado: s.creado,
    actualizado: s.actualizado,
  }),
  ajustes: (a) => ({ nombre: a.nombre, sueldo: a.sueldoSugerido }),
};
const num = (v) => (v == null ? null : Number(v));
const deFila = {
  partidas: (f) => normalizarPartida({ ...f, importe: num(f.importe), cobroAncla: f.cobro_ancla }),
  movimientos: (f) => ({
    id: f.id,
    tipo: f.tipo || "gasto",
    fecha: String(f.fecha).slice(0, 10),
    importe: num(f.importe),
    partidaId: f.partida_id ?? null,
    objetivoId: f.objetivo_id ?? null,
    concepto: f.concepto || "",
    creado: f.creado || f.updated_at || null,
    enlace: f.enlace ?? null,
  }),
  objetivos: (f) => ({ id: f.id, nombre: f.nombre, meta: num(f.meta) || 0, fecha: f.fecha || null, icono: f.icono || "hucha", creado: f.creado }),
  simulaciones: (f) => ({
    sueldo: 0,
    ingresosExtra: 0,
    partidas: [],
    extras: [],
    nota: "",
    ...(f.datos || {}),
    id: f.id,
    nombre: f.nombre,
    creado: f.creado,
    actualizado: f.actualizado || f.updated_at,
  }),
};

// ---------- Guardado en el dispositivo ----------
const K = (u, k) => `cuadra2:${u}:${k}`;
function leerLS(k, def) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}
function escribirLS(k, v) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function mensajeError(e) {
  const m = String(e?.message || e || "").toLowerCase();
  const code = String(e?.code || "");
  if (code === "PGRST205" || code === "42P01" || code === "42703" || (m.includes("could not find") && (m.includes("table") || m.includes("column"))) || m.includes("does not exist"))
    return "Falta actualizar la base de datos: ejecuta el archivo supabase/esquema.sql en el SQL Editor de Supabase.";
  if (m.includes("jwt") || m.includes("token")) return "La sesión ha caducado. Cierra sesión y vuelve a entrar.";
  if (m.includes("fetch") || m.includes("network") || m.includes("load failed")) return "No hay conexión con Supabase.";
  return e?.message || "Error desconocido.";
}

export function traducirAuth(e) {
  const m = String(e?.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Email o contraseña incorrectos.";
  if (m.includes("not confirmed")) return "Confirma tu email antes de entrar: revisa tu bandeja de entrada.";
  if (m.includes("already")) return "Ya existe una cuenta con ese email. Entra con tu contraseña.";
  if (m.includes("signup") && (m.includes("disabled") || m.includes("not allowed"))) return "El registro de cuentas nuevas está desactivado.";
  if (m.includes("password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("fetch") || m.includes("network")) return "Sin conexión. Inténtalo cuando tengas internet.";
  if (m.includes("rate")) return "Demasiados intentos seguidos. Espera un minuto.";
  return e?.message || "Algo ha fallado.";
}

export function motorSupabase({ url, clave, cliente = null }) {
  // "cliente" permite probar el motor sin conectarse a Supabase
  const sb =
    cliente ||
    createClient(url, clave, {
      // La misma clave que la versión anterior: si ya habías entrado, sigues dentro
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "cuadra-auth" },
    });

  let L = {};
  let arrancado = false;
  let usuario = null; // { id, email }
  let estado = null;
  let cola = [];
  let ultimaSync = null;
  let sincronizando = false;
  let repetir = false;
  let conDescarga = false;
  let timer = null;
  let sync = { estado: "ok", error: "" };

  const emitirEstado = () => L.estado?.(estado);
  const emitirSync = (cambios = {}) => {
    sync = { ...sync, ...cambios };
    L.sync?.({ ...sync, pendientes: cola.length, ultima: ultimaSync, email: usuario?.email || "" });
  };
  const guardarLocal = () => {
    if (!usuario) return;
    escribirLS(K(usuario.id, "estado"), estado);
    escribirLS(K(usuario.id, "cola"), cola);
    escribirLS(K(usuario.id, "ultimaSync"), ultimaSync);
  };

  // ---------- Cola de cambios ----------
  function encolar(cambios) {
    for (const c of cambios) {
      // Un cambio sustituye al anterior del mismo registro, en su sitio, para
      // respetar el orden (una partida nueva va antes que sus gastos).
      const i = cola.findIndex((o) => o.tabla === c.tabla && o.id === c.id);
      if (i >= 0) cola[i] = c;
      else cola.push(c);
    }
    guardarLocal();
    emitirSync({ estado: navigator.onLine ? "pendiente" : "offline" });
    programar(700);
  }

  function aplicarLocal(o) {
    if (o.tabla === "ajustes") estado.ajustes = { ...o.fila };
    else if (o.tabla === "meses") {
      if (o.tipo === "delete") delete estado.meses[o.id];
      else estado.meses[o.id] = { sueldo: o.fila.sueldo };
    } else if (o.tipo === "delete") estado[o.tabla] = estado[o.tabla].filter((x) => x.id !== o.id);
    else {
      const lista = estado[o.tabla];
      const i = lista.findIndex((x) => x.id === o.id);
      if (i >= 0) lista[i] = { ...o.fila };
      else lista.push({ ...o.fila });
    }
  }

  async function vaciarCola() {
    while (cola.length) {
      const o = cola[0];
      const ahora = new Date().toISOString();
      let lote = 1;
      let r;
      if (o.tipo === "upsert") {
        // Agrupa los envíos seguidos a la misma tabla en una sola petición
        while (lote < cola.length && lote < 200 && cola[lote].tabla === o.tabla && cola[lote].tipo === "upsert") lote++;
        const filas = cola.slice(0, lote).map((x) => ({ ...aFila[x.tabla](x.fila), user_id: usuario.id, updated_at: ahora }));
        r = await sb.from(o.tabla).upsert(filas, { onConflict: CONFLICTO[o.tabla] });
      } else {
        const q = sb.from(o.tabla).delete().eq("user_id", usuario.id);
        r = await (o.tabla === "meses" ? q.eq("mes", o.id) : q.eq("id", o.id));
      }
      if (r.error) {
        // Datos que la base de datos rechaza: reintentar no lo arreglaría
        if (/^(22|23)/.test(String(r.error.code || "")) && lote === 1) {
          console.warn("Cambio descartado", o, r.error);
          L.aviso?.("Un cambio no se ha podido guardar en la nube y se ha descartado.");
          cola.shift();
          guardarLocal();
          continue;
        }
        throw r.error;
      }
      cola.splice(0, lote);
      guardarLocal();
      emitirSync();
    }
  }

  async function traerTodo(tabla, orden) {
    const out = [];
    for (let desde = 0; ; desde += 1000) {
      let q = sb.from(tabla).select("*").order(orden);
      if (tabla !== "meses") q = q.order("id");
      const { data, error } = await q.range(desde, desde + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }

  async function descargar() {
    const [partidas, objetivos, movimientos, meses, simulaciones, aj] = await Promise.all([
      traerTodo("partidas", "orden"),
      traerTodo("objetivos", "creado"),
      traerTodo("movimientos", "fecha"),
      traerTodo("meses", "mes"),
      traerTodo("simulaciones", "creado"),
      sb.from("ajustes").select("*").maybeSingle(),
    ]);
    if (aj.error) throw aj.error;
    return migrar({
      ajustes: { nombre: aj.data?.nombre || "", sueldoSugerido: num(aj.data?.sueldo) },
      partidas: partidas.map(deFila.partidas),
      objetivos: objetivos.map(deFila.objetivos),
      movimientos: movimientos.map(deFila.movimientos),
      meses: Object.fromEntries(meses.map((f) => [f.mes, { sueldo: num(f.sueldo) }])),
      simulaciones: simulaciones.map(deFila.simulaciones),
    });
  }

  function programar(ms = 800, descarga = false) {
    if (!usuario) return;
    conDescarga = conDescarga || descarga;
    clearTimeout(timer);
    timer = setTimeout(sincronizar, ms);
  }

  async function sincronizar() {
    if (!usuario) return;
    if (sincronizando) {
      repetir = true;
      return;
    }
    if (!navigator.onLine) return emitirSync({ estado: "offline" });
    const descarga = conDescarga || !estado;
    conDescarga = false;
    sincronizando = true;
    emitirSync({ estado: "sincronizando" });
    try {
      await vaciarCola();
      if (descarga) {
        const remoto = await descargar();
        if (!remoto.partidas.length && !cola.length) {
          // Cuenta nueva: se carga el presupuesto inicial y se sube
          estado = semilla(inicial);
          encolar([...estado.partidas.map((p) => ({ tabla: "partidas", tipo: "upsert", id: p.id, fila: p })), { tabla: "ajustes", tipo: "upsert", id: "yo", fila: estado.ajustes }]);
          clearTimeout(timer);
          await vaciarCola();
        } else {
          estado = remoto;
          cola.forEach(aplicarLocal); // cambios hechos mientras se descargaba
        }
        ultimaSync = new Date().toISOString();
        emitirEstado();
      }
      emitirSync({ estado: cola.length ? "pendiente" : "ok", error: "" });
    } catch (e) {
      console.error(e);
      emitirSync({ estado: navigator.onLine ? "error" : "offline", error: mensajeError(e) });
    } finally {
      sincronizando = false;
      guardarLocal();
      if (repetir) {
        repetir = false;
        programar(300);
      }
    }
  }

  // Lo que quedó sin enviar en la versión anterior (gastos apuntados sin conexión)
  function rescatarColaAntigua() {
    const vieja = leerLS(`cuadra:${usuario.id}:cola`, null);
    if (!Array.isArray(vieja) || !vieja.length || leerLS(K(usuario.id, "colaAntigua"), false)) return;
    const cambios = vieja
      .filter((o) => o.tabla === "movimientos")
      .map((o) =>
        o.tipo === "delete"
          ? { tabla: "movimientos", tipo: "delete", id: o.id }
          : {
              tabla: "movimientos",
              tipo: "upsert",
              id: o.id,
              fila: { id: o.id, tipo: "gasto", fecha: o.fila.fecha, importe: Number(o.fila.importe), partidaId: o.fila.partida_id || null, objetivoId: null, concepto: o.fila.concepto || "", creado: new Date().toISOString() },
            }
      );
    if (cambios.length) encolar(cambios);
    escribirLS(K(usuario.id, "colaAntigua"), true);
  }

  function entrarCon(user) {
    if (usuario?.id === user.id) return;
    usuario = { id: user.id, email: user.email };
    escribirLS("cuadra2:ultimoUsuario", usuario);
    const guardado = leerLS(K(usuario.id, "estado"), null);
    estado = guardado ? migrar(guardado) : null;
    cola = leerLS(K(usuario.id, "cola"), []);
    ultimaSync = leerLS(K(usuario.id, "ultimaSync"), null);
    L.sesion?.(usuario);
    if (estado) emitirEstado();
    rescatarColaAntigua();
    emitirSync({ estado: cola.length ? "pendiente" : "ok" });
    programar(0, true);
  }

  function terminar() {
    if (usuario) ["estado", "cola", "ultimaSync"].forEach((k) => escribirLS(K(usuario.id, k), null));
    escribirLS("cuadra2:ultimoUsuario", null);
    usuario = null;
    estado = null;
    cola = [];
    ultimaSync = null;
    L.estado?.(null);
    L.sesion?.(null);
  }

  // Aplica una operación de shared/modelo.js sobre una copia del estado
  async function ejecutar(fn, ...args) {
    if (!estado) throw new Error("Todavía no se han cargado tus datos.");
    const copia = structuredClone(estado);
    const { r, cambios } = fn(copia, ...args);
    estado = copia;
    emitirEstado();
    encolar(cambios);
    return r;
  }
  const existe = (col, id) => Boolean(id && estado?.[col].some((x) => x.id === id));
  const guardar = (col, nombre) => (x) => (existe(col, x.id) ? ejecutar(op[`actualizar${nombre}`], x.id, x) : ejecutar(op[`crear${nombre}`], x));
  const borrar = (nombre) => (id) => ejecutar(op[`borrar${nombre}`], id);

  return {
    tipo: "supabase",
    necesitaCuenta: true,

    async arrancar(oyentes) {
      L = oyentes;
      if (arrancado) {
        L.sesion?.(usuario);
        if (estado) emitirEstado();
        emitirSync();
        return;
      }
      arrancado = true;
      let sesion = null;
      try {
        sesion = (await sb.auth.getSession()).data.session;
      } catch {
        /* sin conexión */
      }
      const ultimo = leerLS("cuadra2:ultimoUsuario", null);
      if (sesion?.user) entrarCon(sesion.user);
      else if (ultimo && !navigator.onLine) entrarCon(ultimo); // sin conexión: se sigue con lo guardado
      else L.sesion?.(null);

      sb.auth.onAuthStateChange((evento, s) => {
        setTimeout(() => {
          if (evento === "SIGNED_OUT") {
            if (usuario) terminar();
            return;
          }
          if (s?.user) entrarCon(s.user);
          if (evento === "TOKEN_REFRESHED") programar(0);
        }, 0);
      });
      window.addEventListener("online", () => programar(0, true));
      window.addEventListener("offline", () => emitirSync({ estado: "offline" }));
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) programar(0, true);
      });
    },

    async entrar(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(traducirAuth(error));
    },
    async registrar(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw new Error(traducirAuth(error));
      return { confirmar: !data.session };
    },
    pendientes: () => cola.length,
    async salir() {
      try {
        await sb.auth.signOut();
      } catch {
        /* sin conexión */
      }
      terminar();
    },
    sincronizar: () => {
      conDescarga = true;
      return sincronizar();
    },

    guardarMovimiento: guardar("movimientos", "Movimiento"),
    borrarMovimiento: borrar("Movimiento"),
    guardarGasto: (m, opciones) => ejecutar(op.guardarGasto, m, opciones),
    restaurarMovimientos: (lista, quitar) => ejecutar(op.restaurarMovimientos, lista, quitar),
    guardarPartida: guardar("partidas", "Partida"),
    borrarPartida: borrar("Partida"),
    guardarObjetivo: guardar("objetivos", "Objetivo"),
    borrarObjetivo: borrar("Objetivo"),
    guardarSimulacion: guardar("simulaciones", "Simulacion"),
    borrarSimulacion: borrar("Simulacion"),
    aplicarSimulacion: (id) => ejecutar(op.aplicarSimulacion, id),
    ponerSueldo: (mes, sueldo) => ejecutar(op.ponerSueldo, mes, sueldo),
    guardarAjustes: (c) => ejecutar(op.guardarAjustes, c),
    importar: (csv) => ejecutar(importarCSV, csv),
  };
}

