import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateProjection, defaultPhases, type Phase } from './compound.ts';
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < Math.max(1e-7, Math.abs(expected) * 1e-10), `${actual} != ${expected}`);
const phase = (amount: number, frequency = 12, years = 10): Phase => ({ id: String(amount), amount: String(amount), frequency: String(frequency), years: String(years) });
test('initial investment matches the compound-interest formula', () => {
  for (const m of [1, 2, 4, 12, 365]) close(calculateProjection(10000, 7, m, 10, [], 'end').at(-1)!.total, 10000 * (1 + .07 / m) ** (m * 10));
});
test('monthly end and beginning deposits match annuity formulas', () => {
  const r = .07 / 12, n = 120, principal = 10000 * (1 + r) ** n;
  const annuity = 500 * ((1 + r) ** n - 1) / r;
  close(calculateProjection(10000, 7, 12, 10, [phase(500)], 'end').at(-1)!.total, principal + annuity);
  close(calculateProjection(10000, 7, 12, 10, [phase(500)], 'beginning').at(-1)!.total, principal + annuity * (1 + r));
});
test('example has exact phases and contributions, including horizon clipping', () => {
  const rows = calculateProjection(10000, 0, 12, 10, defaultPhases, 'end');
  assert.equal(rows[3].contributed, 28000); assert.equal(rows[5].contributed, 52000); assert.equal(rows[10].total, 64000);
  assert.equal(calculateProjection(10000, 0, 12, 2, defaultPhases, 'end').at(-1)!.total, 22000);
  const r = .07 / 12; const future = (p: number, c: number, months: number) => p * (1+r)**months + c * ((1+r)**months-1)/r;
  close(calculateProjection(10000, 7, 12, 10, defaultPhases, 'end').at(-1)!.total, future(future(future(10000,500,36),1000,24),200,60));
});
test('every recurrence and timing counts deposits once across phase boundaries', () => {
  for (const freq of [1,2,4,12,26,52]) for (const timing of ['end','beginning'] as const) {
    const rows = calculateProjection(0, 0, 1, 3, [phase(100, freq, 1),phase(200, freq, 2)], timing);
    assert.equal(rows[1].addition, freq*100); assert.equal(rows[2].addition, freq*200); assert.equal(rows[3].total,freq*500);
  }
});
test('different compounding and deposit frequencies use equivalent periodic rates', () => {
  for (const frequency of [1,4,12,26,52]) {
    const r = 1.06 ** (1/frequency) - 1, n = frequency * 5;
    close(calculateProjection(0,6,1,5,[phase(100,frequency)],'end').at(-1)!.total, 100*((1+r)**n-1)/r);
  }
});
test('zero, pauses, negative rates and long horizons stay consistent', () => {
  assert.equal(calculateProjection(0,0,12,50,[],'end').at(-1)!.total,0);
  const rows = calculateProjection(10000,-5,365,50,[phase(0,12,2),phase(100,52,48)],'beginning');
  for (const row of rows) { assert.ok(Number.isFinite(row.total)); close(row.total,row.contributed+row.gains); }
  assert.equal(rows.at(-1)!.contributed,10000+48*52*100);
});
