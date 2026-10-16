import { DEFAULT_CONFIG } from './viewer.js';

const KEY = 'stereolab-sbs-profiles-v1';
const LIMIT = 20;
const FIELDS = Object.freeze({
  parallax: [-100, 100], scale: [40, 180], panX: [-160, 160],
  panY: [-120, 120], vertical: [-50, 50],
});

/** Solo lee parámetros permitidos; no importa propiedades extrañas de un JSON. */
export function sanitizeCalibration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('El archivo no contiene una calibración válida.');
  }
  const safe = { ...DEFAULT_CONFIG };
  for (const [key, [min, max]] of Object.entries(FIELDS)) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      throw new Error(`Valor inválido para ${key}.`);
    }
    safe[key] = Math.max(min, Math.min(max, value[key]));
  }
  if (value.format !== undefined) {
    if (value.format !== 'full' && value.format !== 'half') throw new Error('Formato SBS desconocido.');
    safe.format = value.format;
  }
  if (value.swap !== undefined) {
    if (typeof value.swap !== 'boolean') throw new Error('Intercambiar L/R debe ser booleano.');
    safe.swap = value.swap;
  }
  return safe;
}

export function createProfileStore() {
  let state = { profiles: [], selectedId: '', applyOnLoad: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.version === 1 && Array.isArray(saved.profiles)) {
      state.profiles = saved.profiles.slice(0, LIMIT).flatMap(profile => {
        try {
          if (typeof profile.id !== 'string' || typeof profile.name !== 'string') return [];
          return [{
            id: profile.id,
            name: profile.name.slice(0, 48),
            settings: sanitizeCalibration(profile.settings),
          }];
        } catch { return []; }
      });
      state.selectedId = typeof saved.selectedId === 'string' ? saved.selectedId : '';
      state.applyOnLoad = saved.applyOnLoad === true;
    }
  } catch { /* Almacenamiento denegado, corrupto o navegación privada: estado vacío. */ }

  function persist(next) {
    // Si falla la persistencia, conservamos el estado anterior; nunca informamos éxito falso.
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, ...next })); }
    catch { throw new Error('No se pudo guardar en este navegador (almacenamiento bloqueado o lleno).'); }
    state = next;
  }
  function selected() { return state.profiles.find(p => p.id === state.selectedId) || null; }

  return {
    getProfiles: () => state.profiles.map(p => ({ ...p, settings: { ...p.settings } })),
    getSelected: () => selected(),
    getApplyOnLoad: () => state.applyOnLoad,
    select(id) {
      if (id && !state.profiles.some(p => p.id === id)) throw new Error('Perfil inexistente.');
      persist({ ...state, selectedId: id });
    },
    save(name, calibration) {
      const cleanName = name.trim();
      if (!cleanName || cleanName.length > 48) throw new Error('Escribe un nombre de 1 a 48 caracteres.');
      const existing = state.profiles.find(p => p.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
      if (!existing && state.profiles.length >= LIMIT) throw new Error('Límite de 20 perfiles: elimina uno para continuar.');
      const profile = {
        id: existing?.id || `sbs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: cleanName,
        settings: sanitizeCalibration(calibration),
      };
      const profiles = existing
        ? state.profiles.map(p => p.id === existing.id ? profile : p)
        : [...state.profiles, profile];
      persist({ ...state, profiles, selectedId: profile.id });
      return { ...profile };
    },
    remove(id = state.selectedId) {
      if (!state.profiles.some(p => p.id === id)) throw new Error('Selecciona un perfil para eliminar.');
      const profiles = state.profiles.filter(p => p.id !== id);
      persist({ ...state, profiles, selectedId: profiles[0]?.id || '', applyOnLoad: state.applyOnLoad && profiles.length > 0 });
    },
    setApplyOnLoad(enabled) {
      if (enabled && !selected()) throw new Error('Guarda o selecciona un perfil antes de activar esta opción.');
      persist({ ...state, applyOnLoad: Boolean(enabled) });
    },
  };
}
