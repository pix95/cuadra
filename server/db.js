// Almacén del modo local: un único archivo JSON (datos/cuadra.json).
// Cada día se guarda una copia en datos/copias/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { semilla, migrar } from "../shared/modelo.js";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Tu presupuesto real (privado, no se sube a GitHub) o, si no existe, el de ejemplo
const PERSONAL = path.join(RAIZ, "presupuesto-personal.js");
const { default: inicial } = await import(pathToFileURL(fs.existsSync(PERSONAL) ? PERSONAL : path.join(RAIZ, "presupuesto-inicial.js")).href);
export const DIR = process.env.CUADRA_DATOS ? path.resolve(process.env.CUADRA_DATOS) : path.join(RAIZ, "datos");
const ARCHIVO = path.join(DIR, "cuadra.json");
const COPIAS = path.join(DIR, "copias");
const MAX_COPIAS = 30;

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let datos = null;
let ultimaCopia = null;

export function iniciar() {
  fs.mkdirSync(DIR, { recursive: true });
  if (fs.existsSync(ARCHIVO)) {
    const txt = fs.readFileSync(ARCHIVO, "utf8");
    try {
      datos = migrar(JSON.parse(txt));
    } catch (e) {
      // Nunca sobrescribir un archivo que no se entiende: mejor parar y avisar.
      throw new Error(`No se puede leer ${ARCHIVO} (${e.message}).\nRestaura una copia de ${COPIAS} o mueve el archivo para empezar de cero.`);
    }
  } else {
    datos = semilla(inicial);
    escribir();
  }
  return datos;
}

export const leer = () => datos;

function copiaDiaria() {
  const dia = hoy();
  if (ultimaCopia === dia || !fs.existsSync(ARCHIVO)) return;
  try {
    fs.mkdirSync(COPIAS, { recursive: true });
    const destino = path.join(COPIAS, `cuadra-${dia}.json`);
    if (!fs.existsSync(destino)) fs.copyFileSync(ARCHIVO, destino);
    fs.readdirSync(COPIAS)
      .filter((f) => /^cuadra-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse()
      .slice(MAX_COPIAS)
      .forEach((f) => fs.rmSync(path.join(COPIAS, f), { force: true }));
    ultimaCopia = dia;
  } catch (e) {
    console.warn("No se ha podido hacer la copia diaria:", e.message);
  }
}

function escribir() {
  const tmp = ARCHIVO + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(datos, null, 2));
  try {
    fs.renameSync(tmp, ARCHIVO);
  } catch {
    // En Windows un antivirus puede bloquear el renombrado un instante
    fs.copyFileSync(tmp, ARCHIVO);
    fs.rmSync(tmp, { force: true });
  }
}

// Aplica una operación de shared/modelo.js y lo guarda en disco. Todo es
// síncrono, así que dos peticiones nunca se pisan. Las operaciones validan
// sobre una copia: si fallan a medias, los datos se quedan como estaban.
export function cambiar(fn) {
  copiaDiaria();
  const copia = structuredClone(datos);
  const { r } = fn(copia);
  datos = copia;
  escribir();
  return r;
}
