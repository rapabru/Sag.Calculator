import type { RigInput } from '../physics';

/**
 * Presets guardados por quien usa la app, en el navegador.
 *
 * Va a `localStorage` a propósito: no hay backend todavía, y el volumen es
 * mínimo. Cuando entre el login con cuenta, esto se sincroniza en vez de
 * reemplazarse — el formato ya lleva `id` y `savedAt` para poder mezclarlos.
 *
 * Todo acceso va envuelto: en navegación privada o con las cookies bloqueadas
 * `localStorage` puede lanzar al escribir, y una excepción ahí no debe tumbar
 * la app.
 */

const RIGS_KEY = 'sagcalc.rigs';
const WEBBINGS_KEY = 'sagcalc.webbings';

export interface SavedRig {
  id: string;
  name: string;
  input: RigInput;
  savedAt: number;
}

export interface SavedWebbing {
  id: string;
  name: string;
  gramsPerMeter: number;
  elongationPct: number;
  savedAt: number;
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento el preset vale para esta sesión y nada más */
  }
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const loadRigs = (): SavedRig[] => read<SavedRig>(RIGS_KEY);
export const loadWebbings = (): SavedWebbing[] => read<SavedWebbing>(WEBBINGS_KEY);

/** Guarda la configuración actual. Si ya hay una con ese nombre, la reemplaza. */
export function saveRig(name: string, input: RigInput): SavedRig[] {
  const clean = name.trim().slice(0, 40);
  if (!clean) return loadRigs();
  const rest = loadRigs().filter((r) => r.name.toLowerCase() !== clean.toLowerCase());
  const next = [...rest, { id: newId(), name: clean, input, savedAt: Date.now() }];
  write(RIGS_KEY, next);
  return next;
}

export function deleteRig(id: string): SavedRig[] {
  const next = loadRigs().filter((r) => r.id !== id);
  write(RIGS_KEY, next);
  return next;
}

export function saveWebbing(name: string, gramsPerMeter: number, elongationPct: number): SavedWebbing[] {
  const clean = name.trim().slice(0, 40);
  if (!clean) return loadWebbings();
  const rest = loadWebbings().filter((w) => w.name.toLowerCase() !== clean.toLowerCase());
  const next = [...rest, { id: newId(), name: clean, gramsPerMeter, elongationPct, savedAt: Date.now() }];
  write(WEBBINGS_KEY, next);
  return next;
}

export function deleteWebbing(id: string): SavedWebbing[] {
  const next = loadWebbings().filter((w) => w.id !== id);
  write(WEBBINGS_KEY, next);
  return next;
}
