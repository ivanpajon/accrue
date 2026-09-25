import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateProjection, defaultPhases, type Phase } from './compound.ts';
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < Math.max(1e-7, Math.abs(expected) * 1e-10), `${actual} != ${expected}`);
const phase = (amount: number, frequency = 12, startYear = 1, endYear = 10): Phase => ({ id: String(amount), amount: String(amount), frequency: String(frequency), startYear: String(startYear), endYear: String(endYear) });
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
    const rows = calculateProjection(0, 0, 1, 3, [phase(100, freq, 1, 1),phase(200, freq, 2, 3)], timing);
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
  const rows = calculateProjection(10000,-5,365,50,[phase(0,12,1,2),phase(100,52,3,50)],'beginning');
  for (const row of rows) { assert.ok(Number.isFinite(row.total)); close(row.total,row.contributed+row.gains); }
  assert.equal(rows.at(-1)!.contributed,10000+48*52*100);
});

test('gaps and early stops have no deposits while the existing balance grows', () => {
  for (const timing of ['end','beginning'] as const) {
    const rows = calculateProjection(0,0,12,7,[phase(100,12,2,3),phase(200,12,5,5)],timing);
    assert.deepEqual(rows.slice(1).map(r=>r.addition),[0,1200,1200,0,2400,0,0]);
    assert.equal(rows.at(-1)!.total,4800);
  }
  close(calculateProjection(0,10,1,4,[phase(100,1,1,2)],'end').at(-1)!.total,254.1);
  close(calculateProjection(0,10,1,4,[phase(100,1,1,2)],'beginning').at(-1)!.total,279.51);
});
test('overlapping phases add together and input order does not matter', () => {
  const phases=[phase(100,12,1,2),phase(200,12,2,3)];
  const rows=calculateProjection(0,0,12,3,phases,'end');
  assert.deepEqual(rows.slice(1).map(r=>r.addition),[1200,3600,2400]);
  for (const timing of ['end','beginning'] as const) {
    const a=calculateProjection(1000,7,12,8,phases,timing);
    const b=calculateProjection(1000,7,12,8,[...phases].reverse(),timing);
    a.forEach((row,i)=>close(row.total,b[i].total));
  }
});
test('explicit ranges clip at the horizon without extending the last phase', () => {
  for (const timing of ['end','beginning'] as const) {
    assert.equal(calculateProjection(0,0,12,3,[phase(100,12,2,5)],timing).at(-1)!.total,2400);
    assert.equal(calculateProjection(0,0,12,3,[phase(100,12,4,5)],timing).at(-1)!.total,0);
    assert.equal(calculateProjection(0,0,12,10,[phase(100,12,2,3)],timing).at(-1)!.total,2400);
    for (const frequency of [1,2,4,12,26,52]) assert.equal(calculateProjection(0,0,12,5,[phase(100,frequency,3,3)],timing).at(-1)!.contributed,frequency*100);
  }
});
test('invalid phase ranges and recurrences are rejected by the engine', () => {
  for (const p of [phase(100,12,3,2),phase(100,12,1.5,3),phase(100,0,1,3),phase(Infinity,12,1,3)]) {
    assert.throws(()=>calculateProjection(0,7,12,10,[p],'end'),RangeError);
  }
});
