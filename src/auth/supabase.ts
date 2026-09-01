import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase, opcional y cargado bajo demanda.
 *
 * Las credenciales llegan por variables de entorno de Vite. Si no están, la app
 * funciona igual: el login queda oculto y el historial vive sólo en el
 * navegador. Eso permite tener el código en producción antes de que exista el
 * proyecto de Supabase, y que cualquiera pueda clonar el repo sin configurar
 * nada.
 *
 * La librería pesa unos 60 kB comprimidos, así que se importa de forma dinámica
 * y sólo cuando hay credenciales: quien no usa la cuenta no la descarga.
 *
 * La clave `anon` es pública por diseño: la seguridad la da Row Level Security
 * en la base, no el secreto de la clave.
 */

// `import.meta.env` sólo existe cuando compila Vite. Los scripts de prueba
// corren en Node, donde no está, así que se lee con cuidado en vez de asumirlo.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const HISTORY_TABLE = 'sag_history';

let clientPromise: Promise<SupabaseClient | null> | null = null;

/** Devuelve el cliente, creándolo la primera vez. `null` si no hay credenciales. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then((m) =>
        m.createClient(url as string, anonKey as string, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        }),
      )
      .catch(() => null);
  }
  return clientPromise;
}
