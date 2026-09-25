import { frequencies, validPhase } from './compound.ts';
import { defaultPreferences, sanitizePreferences, type Preferences } from './preferences.ts';

export type Configuration = Pick<Preferences, 'initial' | 'rate' | 'compounds' | 'years' | 'phases' | 'timing'>;
export type SavedConfiguration = { id: string; name: string; updatedAt: string; configuration: Configuration };
export type PersistedPreferences = Pick<Preferences, 'language' | 'theme' | 'currency' | 'view' | 'visible'> & { savedConfigs: SavedConfiguration[] };
export const MAX_CONFIGURATIONS = 50;
export const MAX_NAME_LENGTH = 80;

export function snapshotConfiguration(value: Configuration): Configuration {
  return { initial: value.initial, rate: value.rate, compounds: value.compounds, years: value.years, timing: value.timing, phases: value.phases.map(p => ({ ...p })) };
}
export function sameConfiguration(a: Configuration, b: Configuration) {
  const comparable = (p: Configuration) => ({ ...snapshotConfiguration(p), phases: p.phases.map(({ id: _id, ...phase }) => phase) });
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}
export function validConfiguration(value: Configuration) {
  const numeric = (s: string, min: number, max: number) => s.trim() !== '' && Number.isFinite(Number(s)) && Number(s) >= min && Number(s) <= max;
  return numeric(value.initial,0,1e9) && numeric(value.rate,-50,100) && numeric(value.years,1,50) && Number.isInteger(Number(value.years))
    && ['1','2','4','12','365'].includes(value.compounds) && value.phases.length <= 100 && value.phases.every(validPhase)
    && (value.timing === 'beginning' || value.timing === 'end');
}
export function persistedPreferences(value: Preferences & { savedConfigs: SavedConfiguration[] }): PersistedPreferences {
  return { language:value.language, theme:value.theme, currency:value.currency, view:value.view, visible:{...value.visible}, savedConfigs:value.savedConfigs };
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const draftNumber = (value: unknown): value is string => typeof value === 'string' && value.length <= 32 && (value === '' || Number.isFinite(Number(value)));
function configurationShape(value: unknown): value is Configuration {
  return record(value) && ['initial','rate','years'].every(key => draftNumber(value[key]))
    && typeof value.compounds === 'string' && ['1','2','4','12','365'].includes(value.compounds)
    && (value.timing === 'beginning' || value.timing === 'end')
    && Array.isArray(value.phases) && value.phases.length <= 100 && value.phases.every(p => record(p) && typeof p.id === 'string' && frequencies.some(f => f.value === p.frequency) && ['amount','startYear','endYear'].every(key => draftNumber(p[key])));
}
/** Restore only preferences and explicit snapshots. The working calculator stays transient. */
export function readStoredPreferences(envelope: unknown): PersistedPreferences | null {
  if (!record(envelope) || !record(envelope.state) || (envelope.version !== 1 && envelope.version !== 2)) return null;
  const state = envelope.state;
  const preferences = sanitizePreferences(state);
  let savedConfigs: SavedConfiguration[] = [];
  if (envelope.version === 1) {
    // Keep a previous custom autosave available without automatically loading it.
    const legacy = configurationShape(state) ? snapshotConfiguration(state) : snapshotConfiguration(preferences);
    if (!sameConfiguration(legacy,defaultPreferences())) savedConfigs = [{ id:'previous-configuration', name:preferences.language === 'es' ? 'Configuración anterior' : 'Previous configuration', updatedAt:new Date().toISOString(), configuration:legacy }];
  } else if (Array.isArray(state.savedConfigs)) {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const value of state.savedConfigs.slice(0,MAX_CONFIGURATIONS)) {
      if (!record(value) || typeof value.id !== 'string' || !value.id || value.id.length > 100 || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > MAX_NAME_LENGTH || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || !configurationShape(value.configuration)) continue;
      const name = value.name.trim();
      if (ids.has(value.id) || names.has(name.toLowerCase())) continue;
      ids.add(value.id); names.add(name.toLowerCase());
      const configuration = snapshotConfiguration(value.configuration);
      configuration.phases = configuration.phases.map((p,i) => ({...p,id:`saved-${i}`}));
      savedConfigs.push({id:value.id,name,updatedAt:value.updatedAt,configuration});
    }
  }
  return persistedPreferences({...preferences,savedConfigs});
}
