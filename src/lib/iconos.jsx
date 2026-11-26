// Iconos de partidas y objetivos, y el color de cada categoría.
import {
  House, Building2, Trash2, Landmark, HandCoins, ShieldCheck, Zap, Droplets, Smartphone, Wifi, Fuel, PawPrint,
  ShoppingBasket, ShoppingCart, Dumbbell, Trophy, Tv, Film, Sparkles, UtensilsCrossed, Coffee, Beer, Shirt, HeartPulse,
  Pill, Stethoscope, Wrench, Car, Bus, Train, Bike, Plane, Umbrella, Package, Gift, PiggyBank, Laptop, Gamepad2, Music,
  BookOpen, GraduationCap, Baby, Scissors, Receipt, Wallet, Briefcase, Ticket, Lightbulb, Hammer, Cat, Dog, Target, Sprout, CalendarClock, Scale,
} from "lucide-react";

export const ICONOS = {
  casa: House, edificio: Building2, basura: Trash2, banco: Landmark, prestamo: HandCoins, seguro: ShieldCheck,
  luz: Zap, agua: Droplets, movil: Smartphone, internet: Wifi, gasolina: Fuel, mascota: PawPrint, gato: Cat, perro: Dog,
  compra: ShoppingBasket, carrito: ShoppingCart, gimnasio: Dumbbell, tenis: Trophy, tv: Tv, cine: Film, ia: Sparkles,
  restaurante: UtensilsCrossed, cafe: Coffee, copas: Beer, ropa: Shirt, salud: HeartPulse, farmacia: Pill,
  medico: Stethoscope, taller: Wrench, coche: Car, bus: Bus, tren: Train, bici: Bike, viaje: Plane, imprevistos: Umbrella,
  paquete: Package, regalo: Gift, hucha: PiggyBank, ordenador: Laptop, juegos: Gamepad2, musica: Music, libros: BookOpen,
  estudios: GraduationCap, bebe: Baby, peluqueria: Scissors, recibo: Receipt, cartera: Wallet, trabajo: Briefcase,
  entradas: Ticket, idea: Lightbulb, obras: Hammer, meta: Target, planta: Sprout, calendario: CalendarClock, ajuste: Scale,
};

export const ICONOS_OBJETIVO = ["hucha", "viaje", "casa", "coche", "regalo", "ordenador", "imprevistos", "estudios", "bebe", "juegos", "meta", "planta"];

const COLOR_CATEGORIA = {
  Vivienda: "#b58cf2",
  Deudas: "#ff8a95",
  Seguros: "#8fa2ff",
  Suministros: "#f4cf6a",
  Transporte: "#78c6f2",
  Mascotas: "#f6a57c",
  "Alimentación": "#8fe0a6",
  Deporte: "#64dccb",
  Suscripciones: "#e79bf2",
  Ocio: "#f27fae",
  Salud: "#ff9fb7",
  Otros: "#b4abb8",
  "Sin partida": "#8a818e",
  "Gastos puntuales": "#f6a57c",
};
const PALETA = ["#b58cf2", "#f27fae", "#f6a57c", "#78c6f2", "#8fe0a6", "#f4cf6a", "#ff8a95", "#8fa2ff", "#64dccb", "#e79bf2"];

export function colorCategoria(cat) {
  if (COLOR_CATEGORIA[cat]) return COLOR_CATEGORIA[cat];
  let h = 0;
  for (const c of String(cat)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

const ICONO_CATEGORIA = {
  Vivienda: "casa", Deudas: "prestamo", Seguros: "seguro", Suministros: "luz", Transporte: "coche", Mascotas: "mascota",
  "Alimentación": "compra", Deporte: "gimnasio", Suscripciones: "tv", Ocio: "restaurante", Salud: "salud", Otros: "paquete",
  "Gastos puntuales": "recibo",
};
export const iconoCategoria = (cat) => ICONO_CATEGORIA[cat] || "paquete";

export function Icono({ nombre, size = 20, ...rest }) {
  const C = ICONOS[nombre] || Package;
  return <C size={size} strokeWidth={1.9} {...rest} />;
}

// Cuadradito de color con el icono dentro
export function Ficha({ icono, color = "#b4abb8", size = 44, radio, className = "" }) {
  return (
    <span
      className={`ficha ${className}`}
      style={{ "--c": color, width: size, height: size, borderRadius: radio ?? Math.round(size * 0.32) }}
      aria-hidden="true"
    >
      <Icono nombre={icono} size={Math.round(size * 0.46)} />
    </span>
  );
}
