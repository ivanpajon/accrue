import type { Phase } from './compound.ts';

export type YearRange = Pick<Phase, 'startYear' | 'endYear'>;
export type YearEndpoint = keyof YearRange;

export function investmentHorizon(years: number) {
  return Number.isFinite(years) ? Math.min(50, Math.max(1, Math.round(years))) : 1;
}

/** Fit committed, ordered dates to a valid horizon, retaining unfinished date drafts. */
export function fitPhasesToHorizon(phases: Phase[], years: number): Phase[] {
  if (!Number.isInteger(years) || years < 1 || years > 50) return phases;
  return phases.map(phase => {
    const start = Number(phase.startYear), end = Number(phase.endYear);
    if (!Number.isInteger(start) || start < 1 || start > 50 || !Number.isInteger(end) || end < start || end > 50) return phase;
    return {...phase,startYear:String(Math.min(start,years)),endYear:String(Math.min(end,years))};
  });
}

/** Normalize an editor draft without changing the saved phase. The edited endpoint wins. */
export function normalizeYearRange(draft: YearRange, years: number, edited: YearEndpoint = 'startYear', fallback: YearRange = draft): YearRange {
  const max = investmentHorizon(years);
  const year = (value: string, previous: string) => {
    const numeric = value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : Number(previous);
    return Math.min(max, Math.max(1, Math.round(Number.isFinite(numeric) ? numeric : 1)));
  };
  let start = year(draft.startYear, fallback.startYear);
  let end = year(draft.endYear, fallback.endYear);
  if (start > end) {
    if (edited === 'endYear') start = end;
    else end = start;
  }
  return { startYear: String(start), endYear: String(end) };
}
