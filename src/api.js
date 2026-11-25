async function pedir(metodo, ruta, cuerpo) {
  let res;
  try {
    res = await fetch("/api" + ruta, {
      method: metodo,
      headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new Error("No hay conexión con el servidor de Cuadra.");
  }
  let datos = null;
  try {
    datos = await res.json();
  } catch {
    /* respuesta vacía */
  }
  if (!res.ok) throw new Error(datos?.error || `Error ${res.status}`);
  return datos;
}

export const api = {
  get: (r) => pedir("GET", r),
  post: (r, c = {}) => pedir("POST", r, c),
  put: (r, c = {}) => pedir("PUT", r, c),
  del: (r) => pedir("DELETE", r),
};
