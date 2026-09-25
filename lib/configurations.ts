import { validPhase } from './compound.ts';
import { type Preferences } from './preferences.ts';

export type Configuration = Pick<Preferences, 'initial' | 'rate' | 'compounds' | 'years' | 'phases' | 'timing'>;
export type SavedConfiguration = { id: string; name: string; revision: number; updatedAt: string; configuration: Configuration };
export const MAX_CONFIGURATIONS = 50;
export const MAX_NAME_LENGTH = 80;

export function snapshotConfiguration(value: Configuration): Configuration {
  return { initial: value.initial, rate: value.rate, compounds: value.compounds, years: value.years, timing: value.timing, phases: value.phases.map(p => ({ ...p })) };
}
export function sameConfiguration(a: Configuration, b: Configuration) {
  const comparable = (p: Configuration) => ({ ...snapshotConfiguration(p), phases: p.phases.map(phase => ({amount:phase.amount,frequency:phase.frequency,startYear:phase.startYear,endYear:phase.endYear})) });
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}
export function validConfiguration(value: Configuration) {
  const numeric = (s: string, min: number, max: number) => s.trim() !== '' && Number.isFinite(Number(s)) && Number(s) >= min && Number(s) <= max;
  return numeric(value.initial,0,1e9) && numeric(value.rate,-50,100) && numeric(value.years,1,50) && Number.isInteger(Number(value.years))
    && ['1','2','4','12','365'].includes(value.compounds) && value.phases.length <= 100 && value.phases.every(validPhase)
    && (value.timing === 'beginning' || value.timing === 'end');
}
