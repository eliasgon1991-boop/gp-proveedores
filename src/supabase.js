import { createClient } from "@supabase/supabase-js";

// ═══ Cliente de Supabase (cuentas + perfil en la nube) ═══
// Sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY la app funciona igual que
// siempre en modo invitado: el estado vive en el navegador y no hay cuentas.
// La anon key es pública por diseño; la seguridad real la ponen las políticas
// RLS de supabase/esquema.sql.

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase = url && anon ? createClient(url, anon) : null;
