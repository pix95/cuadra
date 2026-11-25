// Elige dónde se guardan los datos (ver src/config.js)
import { MOTOR, SUPABASE } from "../config.js";
import { motorServidor } from "./servidor.js";
import { motorSupabase } from "./supabase.js";

export const motor = MOTOR === "supabase" ? motorSupabase(SUPABASE) : motorServidor();
