export type Phase = { id: string; amount: string; frequency: string; startYear: string; endYear: string };
export type ProjectionRow = { year: number; total: number; contributed: number; gains: number; addition: number; interest: number };
export const frequencies = [
  { value: '12', label: 'Monthly' }, { value: '52', label: 'Weekly' },
  { value: '26', label: 'Every 2 weeks' }, { value: '4', label: 'Quarterly' },
  { value: '2', label: 'Half-yearly' }, { value: '1', label: 'Yearly' },
];
export const defaultPhases: Phase[] = [
  { id: 'first', amount: '500', frequency: '12', startYear: '1', endYear: '3' },
  { id: 'second', amount: '1000', frequency: '12', startYear: '4', endYear: '5' },
  { id: 'third', amount: '200', frequency: '12', startYear: '6', endYear: '10' },
];
export function phaseRanges(phases: Phase[], years: number) {
  return phases.map((phase) => {
    const start = Number(phase.startYear) - 1;
    const end = Number(phase.endYear);
    return { ...phase, start, end, activeYears: Math.max(0, Math.min(end, years) - start) };
  });
}
export function validPhase(phase: Phase) {
  return phase.amount.trim() !== '' && Number.isFinite(Number(phase.amount)) && Number(phase.amount) >= 0 && Number(phase.amount) <= 1e9
    && frequencies.some(f => f.value === phase.frequency)
    && Number.isInteger(Number(phase.startYear)) && Number(phase.startYear) >= 1 && Number(phase.startYear) <= 50
    && Number.isInteger(Number(phase.endYear)) && Number(phase.endYear) >= Number(phase.startYear) && Number(phase.endYear) <= 50;
}
/** Inclusive gaps in coverage, including years before the first and after the last phase. */
export function contributionGaps(phases: Phase[], years: number) {
  const gaps: { startYear: number; endYear: number }[] = [];
  for (let year = 1; year <= years; year++) {
    if (phases.some(p => Number(p.amount) > 0 && Number(p.startYear) <= year && Number(p.endYear) >= year)) continue;
    const last = gaps.at(-1);
    if (last && last.endYear === year - 1) last.endYear = year;
    else gaps.push({ startYear: year, endYear: year });
  }
  return gaps;
}
/** Nominal APR converted to equivalent growth between exact deposit events.
 * Fixed financial year: 12 months / 52 weeks / 26 fortnights. No intermediate rounding.
 * Beginning deposits on a year boundary belong to the following year.
 */
export function calculateProjection(initial: number, rate: number, compounds: number, years: number, phases: Phase[], timing: 'end' | 'beginning'): ProjectionRow[] {
  if (!Number.isFinite(initial) || initial < 0 || !Number.isFinite(rate) || ![1,2,4,12,365].includes(compounds) || 1 + rate/100/compounds <= 0 || !Number.isInteger(years) || years < 1 || years > 50 || !phases.every(validPhase)) throw new RangeError('Invalid projection inputs');
  const events: { time: number; amount: number }[] = [];
  for (const phase of phaseRanges(phases, years)) {
    if (phase.activeYears <= 0) continue;
    const frequency = Number(phase.frequency);
    const count = Math.round(phase.activeYears * frequency);
    for (let i = 0; i < count; i++) events.push({ time: phase.start + (i + (timing === 'end' ? 1 : 0)) / frequency, amount: Number(phase.amount) });
  }
  events.sort((a, b) => a.time - b.time);
  let total = initial, contributed = initial, previousTime = 0, eventIndex = 0;
  const base = 1 + rate / 100 / compounds;
  const growTo = (time: number) => { total *= Math.pow(base, compounds * (time - previousTime)); previousTime = time; };
  const rows: ProjectionRow[] = [{ year: 0, total, contributed, gains: 0, addition: 0, interest: 0 }];
  for (let year = 1; year <= years; year++) {
    while (eventIndex < events.length && (timing === 'end' ? events[eventIndex].time <= year + 1e-9 : events[eventIndex].time < year - 1e-9)) {
      const event = events[eventIndex++]; growTo(event.time); total += event.amount; contributed += event.amount;
    }
    growTo(year);
    const previous = rows[rows.length - 1];
    const gains = total - contributed;
    rows.push({ year, total, contributed, gains, addition: contributed - previous.contributed, interest: gains - previous.gains });
  }
  return rows;
}
