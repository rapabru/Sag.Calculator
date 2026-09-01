import type { CalcResult, RigInput } from '../physics';
import { HISTORY_TABLE, getSupabase, isSupabaseConfigured } from '../auth/supabase';

/**
 * Historial de sesiones calculadas.
 *
 * Sólo se guarda una entrada cuando la configuración cambió de verdad respecto
 * de la anterior: mover un slider de ida y vuelta hasta el mismo valor no deja
 * rastro. Sin eso el historial se llenaría de ruido en segundos.
 *
 * `localStorage` es la fuente de verdad y funciona sin conexión ni cuenta.
 * Cuando hay sesión de Supabase se sincroniza contra ella, mezclando por `id`.
 */

const KEY = 'sagcalc.history';
const MAX_ENTRIES = 60;

export interface HistorySummary {
  span: number;
  pretensionKN: number;
  massKg: number;
  sag: number;
  clearance: number;
  usesLeash: boolean;
  lowestBodyPoint: number | null;
  peakForceKN: number | null;
  hitsGround: boolean;
}

export interface HistoryEntry {
  id: string;
  savedAt: number;
  input: RigInput;
  summary: HistorySummary;
}

function read(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* sin almacenamiento el historial vale sólo para esta sesión */
  }
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Dos configuraciones son la misma si todos sus campos numéricos coinciden. */
export function sameInput(a: RigInput, b: RigInput): boolean {
  const keys = Object.keys(a) as Array<keyof RigInput>;
  return keys.every((k) => {
    const x = a[k];
    const y = b[k];
    return typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) < 1e-9 : x === y;
  });
}

export function summarize(input: RigInput, result: CalcResult): HistorySummary {
  return {
    span: input.span,
    pretensionKN: input.pretensionN / 1000,
    massKg: input.personMassKg,
    sag: result.static.loaded.sagMax,
    clearance: result.static.groundClearance,
    usesLeash: input.usesLeash,
    lowestBodyPoint: input.usesLeash ? result.fall.lowestBodyPoint : null,
    peakForceKN: input.usesLeash ? result.fall.peakForceN / 1000 : null,
    hitsGround: input.usesLeash && result.fall.hitsGround,
  };
}

export const loadHistory = (): HistoryEntry[] => read();

/**
 * Agrega una entrada si la configuración cambió respecto de la última.
 * Devuelve la lista nueva, o la misma si no había nada que guardar.
 */
export function recordEntry(input: RigInput, result: CalcResult): HistoryEntry[] {
  const current = read();
  if (current.length > 0 && sameInput(current[0].input, input)) return current;
  const entry: HistoryEntry = {
    id: newId(),
    savedAt: Date.now(),
    input,
    summary: summarize(input, result),
  };
  const next = [entry, ...current].slice(0, MAX_ENTRIES);
  write(next);
  void pushRemote(entry);
  return next;
}

export function deleteEntry(id: string): HistoryEntry[] {
  const next = read().filter((e) => e.id !== id);
  write(next);
  void deleteRemote(id);
  return next;
}

export function clearHistory(): HistoryEntry[] {
  write([]);
  return [];
}

/* ------------------------------------------------------------------ */
/* Sincronización con Supabase. Todo silencioso: si falla, el historial */
/* local sigue funcionando igual.                                       */
/* ------------------------------------------------------------------ */

async function pushRemote(entry: HistoryEntry): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const client = await getSupabase();
    if (!client) return;
    const { data } = await client.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await client.from(HISTORY_TABLE).upsert({
      id: entry.id,
      user_id: userId,
      saved_at: new Date(entry.savedAt).toISOString(),
      input: entry.input,
      summary: entry.summary,
    });
  } catch {
    /* sin conexión el historial local es suficiente */
  }
}

async function deleteRemote(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const client = await getSupabase();
    if (!client) return;
    await client.from(HISTORY_TABLE).delete().eq('id', id);
  } catch {
    /* idem */
  }
}

/** Trae lo guardado en la cuenta y lo mezcla con lo local, sin duplicar. */
export async function syncFromRemote(): Promise<HistoryEntry[]> {
  const local = read();
  if (!isSupabaseConfigured) return local;
  try {
    const client = await getSupabase();
    if (!client) return local;
    const { data, error } = await client
      .from(HISTORY_TABLE)
      .select('id, saved_at, input, summary')
      .order('saved_at', { ascending: false })
      .limit(MAX_ENTRIES);
    if (error || !data) return local;

    const remote: HistoryEntry[] = data.map((row) => ({
      id: row.id as string,
      savedAt: new Date(row.saved_at as string).getTime(),
      input: row.input as RigInput,
      summary: row.summary as HistorySummary,
    }));

    const byId = new Map<string, HistoryEntry>();
    for (const e of [...remote, ...local]) byId.set(e.id, e);
    const merged = [...byId.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_ENTRIES);
    write(merged);

    // Lo que estaba sólo local se sube, para que la cuenta quede completa.
    const remoteIds = new Set(remote.map((e) => e.id));
    for (const e of local) if (!remoteIds.has(e.id)) void pushRemote(e);

    return merged;
  } catch {
    return local;
  }
}
