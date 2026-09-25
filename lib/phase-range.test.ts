import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeYearRange } from './phase-range.ts';

test('year entry rounds fractions and stays inside the investment period', () => {
  assert.deepEqual(normalizeYearRange({startYear:'2.6',endYear:'6'},10), {startYear:'3',endYear:'6'});
  assert.deepEqual(normalizeYearRange({startYear:'-2',endYear:'99'},10), {startYear:'1',endYear:'10'});
});

test('moving either endpoint through the other produces a one-year phase', () => {
  assert.deepEqual(normalizeYearRange({startYear:'7',endYear:'4'},10,'startYear'), {startYear:'7',endYear:'7'});
  assert.deepEqual(normalizeYearRange({startYear:'6',endYear:'3'},10,'endYear'), {startYear:'3',endYear:'3'});
});

test('blank or non-finite drafts restore the committed endpoint within the horizon', () => {
  const previous = {startYear:'2',endYear:'8'};
  assert.deepEqual(normalizeYearRange({startYear:'',endYear:'6'},10,'startYear',previous), {startYear:'2',endYear:'6'});
  assert.deepEqual(normalizeYearRange({startYear:'2',endYear:'Infinity'},5,'endYear',previous), {startYear:'2',endYear:'5'});
});

test('opening a phase outside a shorter horizon creates a valid draft without mutating the phase', () => {
  const phase = {startYear:'12',endYear:'20'};
  assert.deepEqual(normalizeYearRange(phase,10), {startYear:'10',endYear:'10'});
  assert.deepEqual(phase, {startYear:'12',endYear:'20'});
  assert.deepEqual(normalizeYearRange(phase,1), {startYear:'1',endYear:'1'});
});

test('apply rechecks the current horizon even if it changed after editing', () => {
  const draft = normalizeYearRange({startYear:'3',endYear:'12'},20,'endYear');
  assert.deepEqual(normalizeYearRange(draft,5,'endYear'), {startYear:'3',endYear:'5'});
});
