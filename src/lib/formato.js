// Formato de importes y fechas en español.

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

const agrupar = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Separa un importe en signo, parte entera ("1.234") y decimales ("08")
export function partes(n) {
  const v = r2(n);
  const abs = Math.abs(v);
  const ent = Math.floor(abs + 1e-9);
  const dec = Math.min(99, Math.round((abs - ent) * 100));
  return { neg: v < 0 && abs >= 0.005, entero: agrupar(String(ent)), dec: String(dec).padStart(2, "0") };
}

// 1234.5 → "1.234,50 €"; con corto, los enteros sin decimales → "1.234 €"
export function eur(n, { signo = false, corto = false } = {}) {
  const { neg, entero, dec } = partes(n);
  const s = neg ? "−" : signo && r2(n) > 0 ? "+" : "";
  return `${s}${entero}${corto && dec === "00" ? "" : "," + dec} €`;
}

export const pct = (n) => `${Math.round(n)} %`;
export const pct1 = (n) => `${(Math.round(n * 10) / 10).toString().replace(".", ",")} %`;

// Convierte lo que escribe la persona ("12,50", "1.234,5", "-3") en número
export function parseImporte(txt) {
  let s = String(txt ?? "").trim().replace(/[€\s ]/g, "").replace("−", "-");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return r2(parseFloat(s));
}
export const aInput = (n) => {
  if (n == null || n === "") return "";
  const v = r2(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
};

// ---------- Fechas ----------
const pad = (n) => String(n).padStart(2, "0");
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoyISO = () => iso(new Date());
export const mesActual = () => hoyISO().slice(0, 7);
export const fechaDe = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d || 1);
};

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];

export const mayus = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function nombreMes(ym, { año = false, cap = false } = {}) {
  const [y, m] = ym.split("-").map(Number);
  const t = MESES[m - 1] + (año ? ` ${y}` : "");
  return cap ? mayus(t) : t;
}
export function mesCorto(ym, { año = false } = {}) {
  const [y, m] = ym.split("-").map(Number);
  return mayus(MESES_CORTOS[m - 1]) + (año ? ` ${y}` : "");
}

export function moverMes(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function diasEnMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
export const sumarDias = (f, n) => {
  const d = fechaDe(f);
  d.setDate(d.getDate() + n);
  return iso(d);
};

// "25 nov"
export function fechaCorta(f) {
  const [, m, d] = f.split("-").map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}
// "martes 25"
export function diaSemana(f) {
  const d = fechaDe(f);
  return `${DIAS[d.getDay()]} ${d.getDate()}`;
}
// "Hoy", "Ayer" o "martes 25 nov"
export function fechaRelativa(f) {
  const h = hoyISO();
  if (f === h) return "Hoy";
  if (f === sumarDias(h, -1)) return "Ayer";
  if (f === sumarDias(h, 1)) return "Mañana";
  const d = fechaDe(f);
  const año = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${mayus(DIAS[d.getDay()])} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}${año}`;
}

export function saludo() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Buenos días";
  if (h >= 14 && h < 21) return "Buenas tardes";
  return "Buenas noches";
}

export const uuid = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      });
