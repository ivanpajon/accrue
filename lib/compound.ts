export type Phase = { id: string; amount: string; frequency: string; years: string };
export type ProjectionRow = { year: number; total: number; contributed: number; gains: number; addition: number; interest: number };
export const frequencies = [
  { value: '12', label: 'Monthly' }, { value: '52', label: 'Weekly' },
  { value: '26', label: 'Every 2 weeks' }, { value: '4', label: 'Quarterly' },
  { value: '2', label: 'Half-yearly' }, { value: '1', label: 'Yearly' },
];
export const defaultPhases: Phase[] = [
  { id: 'first', amount: '500', frequency: '12', years: '3' },
  { id: 'second', amount: '1000', frequency: '12', years: '2' },
  { id: 'third', amount: '200', frequency: '12', years: '5' },
];
export function phaseRanges(phases: Phase[], years: number) {
  let cursor = 0;
  return phases.map((phase, index) => {
    const start = cursor;
    const end = index === phases.length - 1 ? Math.max(start, years) : start + Math.max(0, Number(phase.years) || 0);
    cursor = end;
    return { ...phase, start, end, activeYears: Math.max(0, Math.min(end, years) - start) };
  });
}
/** Nominal APR converted to equivalent growth between exact deposit events.
 * Fixed financial year: 12 months / 52 weeks / 26 fortnights. No intermediate rounding.
 * Beginning deposits on a year boundary belong to the following year.
 */
export function calculateProjection(initial: number, rate: number, compounds: number, years: number, phases: Phase[], timing: 'end' | 'beginning'): ProjectionRow[] {
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
