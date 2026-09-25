import { defaultPhases, frequencies, type Phase } from './compound.ts';
import type { Language } from './i18n.ts';
export type Theme = 'system' | 'light' | 'dark';
export type Preferences = {
  language: Language; theme: Theme; currency: 'USD' | 'EUR';
  initial: string; rate: string; compounds: string; years: string; phases: Phase[];
  timing: 'end' | 'beginning'; view: 'growth' | 'table';
  visible: { total: boolean; contributed: boolean; gains: boolean };
};
export const STORAGE_KEY = 'compound-planner-v1';
export function defaultPreferences(): Preferences {
  return { language: 'en', theme: 'system', currency: 'USD', initial: '10000', rate: '7', compounds: '12', years: '10', phases: defaultPhases.map(p => ({ ...p })), timing: 'end', view: 'growth', visible: { total: true, contributed: true, gains: true } };
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numeric = (value: unknown, min: number, max: number, integer = false): value is string => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max && (!integer || Number.isInteger(Number(value)));
const numericDraft = (value: unknown): value is string => typeof value === 'string' && value.length <= 32 && (value === '' || Number.isFinite(Number(value)));
/** Only restore recognized, valid fields; stale or malformed storage cannot replace actions. */
export function sanitizePreferences(value: unknown): Preferences {
  const defaults = defaultPreferences();
  if (!record(value)) return defaults;
  return {
    language: value.language === 'es' ? 'es' : 'en',
    theme: value.theme === 'dark' || value.theme === 'light' ? value.theme : 'system',
    currency: value.currency === 'EUR' ? 'EUR' : 'USD',
    initial: numeric(value.initial, 0, 1e9) ? value.initial : defaults.initial,
    rate: numeric(value.rate, -50, 100) ? value.rate : defaults.rate,
    compounds: typeof value.compounds === 'string' && ['1','2','4','12','365'].includes(value.compounds) ? value.compounds : defaults.compounds,
    years: numeric(value.years, 1, 50, true) ? value.years : defaults.years,
    // Preserve unfinished numeric edits; projection validation still rejects invalid ranges.
    phases: Array.isArray(value.phases) && value.phases.length <= 100 && value.phases.every(p => record(p) && typeof p.id === 'string' && frequencies.some(f => f.value === p.frequency) && ['amount','startYear','endYear'].every(k => numericDraft(p[k])))
      ? value.phases.map((p, i) => ({ id: `saved-${i}`, amount: p.amount, frequency: p.frequency, startYear: p.startYear, endYear: p.endYear })) : defaults.phases,
    timing: value.timing === 'beginning' ? 'beginning' : 'end',
    view: value.view === 'table' ? 'table' : 'growth',
    visible: record(value.visible) && ['total','contributed','gains'].every(k => typeof (value.visible as Record<string, unknown>)[k] === 'boolean') ? value.visible as Preferences['visible'] : defaults.visible,
  };
}
// Applied before paint. Language defaults to English; appearance defaults to the OS.
export const preferenceBootstrap = `(function(){try{var p=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'null');var s=p&&p.version===1&&p.state||{};var theme=s.theme==='light'||s.theme==='dark'?s.theme:'system';var dark=theme==='dark'||theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(dark?'dark':'light');document.documentElement.style.colorScheme=dark?'dark':'light';document.documentElement.lang=s.language==='es'?'es':'en';}catch(e){var dark=matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(dark?'dark':'light');document.documentElement.style.colorScheme=dark?'dark':'light';}})();`;
