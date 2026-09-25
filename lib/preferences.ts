import { defaultPhases, type Phase } from './compound.ts';
import type { Language } from './i18n.ts';
export type Theme = 'system' | 'light' | 'dark';
export type Preferences = {
  language: Language; theme: Theme; currency: 'USD' | 'EUR';
  initial: string; rate: string; compounds: string; years: string; phases: Phase[];
  timing: 'end' | 'beginning'; view: 'growth' | 'table';
  visible: { total: boolean; contributed: boolean; gains: boolean };
};
export function defaultPreferences(): Preferences {
  return { language: 'en', theme: 'system', currency: 'USD', initial: '10000', rate: '7', compounds: '1', years: '10', phases: defaultPhases.map(p => ({ ...p })), timing: 'end', view: 'growth', visible: { total: true, contributed: true, gains: true } };
}
// Use the OS appearance before account preferences finish loading.
export const preferenceBootstrap = `(function(){var dark=matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(dark?'dark':'light');document.documentElement.style.colorScheme=dark?'dark':'light';})();`;
