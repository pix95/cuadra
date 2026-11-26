// Modo local: los datos están en el servidor Node de este ordenador (/api).
import { api } from "../api.js";

const upsert = (lista, x) => {
  const i = lista.findIndex((y) => y.id === x.id);
  if (i < 0) return [...lista, x];
  const c = lista.slice();
  c[i] = x;
  return c;
};

export function motorServidor() {
  let estado = null;
  let L = {};
  const poner = (nuevo) => {
    estado = nuevo;
    L.estado?.(estado);
  };
  const existe = (col, id) => id && estado?.[col].some((x) => x.id === id);
  const guardarEn = (col) => async (x) => {
    const r = existe(col, x.id) ? await api.put(`/${col}/${x.id}`, x) : await api.post(`/${col}`, x);
    poner({ ...estado, [col]: upsert(estado[col], r) });
    return r;
  };
  const borrarDe = (col) => async (id) => {
    await api.del(`/${col}/${id}`);
    poner({ ...estado, [col]: estado[col].filter((x) => x.id !== id) });
  };

  // Operación compuesta: el servidor devuelve el resultado y el estado entero
  const remoto = async (nombre, ...args) => {
    const { r, estado: nuevo } = await api.post(`/op/${nombre}`, { args });
    poner(nuevo);
    return r;
  };

  async function cargar() {
    try {
      L.sync?.({ estado: "sincronizando" });
      poner(await api.get("/estado"));
      L.sync?.({ estado: "local" });
    } catch (e) {
      L.sync?.({ estado: "error", error: e.message });
    }
  }

  return {
    tipo: "servidor",
    necesitaCuenta: false,
    arrancar(oyentes) {
      L = oyentes;
      L.sesion?.({ local: true });
      if (estado) L.estado?.(estado);
      else cargar();
    },
    sincronizar: cargar,
    guardarMovimiento: guardarEn("movimientos"),
    borrarMovimiento: (id) => remoto("borrarMovimiento", id),
    guardarGasto: (m, opciones) => remoto("guardarGasto", m, opciones),
    restaurarMovimientos: (lista, quitar) => remoto("restaurarMovimientos", lista, quitar),
    guardarVehiculo: (x) => (existe("vehiculos", x.id) ? remoto("actualizarVehiculo", x.id, x) : remoto("crearVehiculo", x)),
    borrarVehiculo: (id) => remoto("borrarVehiculo", id),
    guardarRecordatorio: (x) => (existe("recordatorios", x.id) ? remoto("actualizarRecordatorio", x.id, x) : remoto("crearRecordatorio", x)),
    borrarRecordatorio: (id) => remoto("borrarRecordatorio", id),
    borrarRegistroCoche: (tabla, id) => remoto("borrarRegistroCoche", tabla, id),
    guardarPartida: guardarEn("partidas"),
    borrarPartida: borrarDe("partidas"),
    guardarObjetivo: guardarEn("objetivos"),
    borrarObjetivo: borrarDe("objetivos"),
    guardarSimulacion: guardarEn("simulaciones"),
    borrarSimulacion: borrarDe("simulaciones"),
    async aplicarSimulacion(id) {
      const r = await api.post(`/simulaciones/${id}/aplicar`);
      poner({ ...estado, partidas: r.partidas });
    },
    async ponerSueldo(mes, sueldo, opciones) {
      const r = await api.put(`/meses/${mes}`, { sueldo, ...(opciones && "ingresada" in opciones ? { ingresada: opciones.ingresada ?? null } : {}) });
      poner({ ...estado, meses: r.meses, ajustes: r.ajustes });
    },
    async guardarAjustes(cambios) {
      const r = await api.put("/ajustes", cambios);
      poner({ ...estado, ajustes: r });
    },
    async importar(csv) {
      const r = await api.post("/importar", { csv });
      poner(r.estado);
      return r.resumen;
    },
  };
}
