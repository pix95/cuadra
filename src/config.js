// Dónde guarda Cuadra los datos.
//
// - "supabase": en la nube (tu proyecto de Supabase). Es lo que usa la app
//   publicada en GitHub Pages: la misma cuenta en el móvil y en el ordenador.
// - "servidor": en el servidor Node de este ordenador (carpeta datos/).
//   Se usa con "npm run app" o "npm run dev:local".
//
// La clave de Supabase es la pública ("publishable"): puede verse sin problema,
// porque cada fila está protegida para que solo la lea y la cambie su dueño.

export const SUPABASE = {
  url: "https://qqnmrrgnldqolkvmwrkz.supabase.co",
  clave: "sb_publishable_YLJRI5ayqaI-utW2l6mjJw_PYjZwL5o",
};

// Icono de la app (respeta la carpeta en la que se publique)
export const ICONO = `${import.meta.env.BASE_URL}icono.svg`;

export const MOTOR = import.meta.env.VITE_MOTOR || (SUPABASE.url && SUPABASE.clave ? "supabase" : "servidor");
