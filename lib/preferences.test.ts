import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPreferences } from './preferences.ts';
import { messages, translator } from './i18n.ts';
import { contributionGaps } from './compound.ts';
test('defaults are English, system theme, USD, and yearly compounding', () => {
  const p=defaultPreferences(); assert.equal(p.language,'en'); assert.equal(p.theme,'system'); assert.equal(p.currency,'USD');
  assert.equal(p.compounds,'1');
});
test('every translation exists in both languages and has the same placeholders', () => {
  assert.deepEqual(Object.keys(messages.en).sort(),Object.keys(messages.es).sort());
  for(const key of Object.keys(messages.en) as (keyof typeof messages.en)[]) {
    assert.ok(messages.es[key].length>0,key);
    assert.deepEqual((messages.en[key].match(/\{\w+\}/g)||[]).sort(),(messages.es[key].match(/\{\w+\}/g)||[]).sort(),key);
  }
  assert.equal(translator('es')('yearRange',{start:2,end:4}),'Años 2–4');
});
test('timeline gaps agree with independent phases, including zero-contribution pauses', () => {
  const phases=[{id:'a',amount:'100',frequency:'12',startYear:'2',endYear:'3'},{id:'b',amount:'0',frequency:'12',startYear:'4',endYear:'5'}];
  assert.deepEqual(contributionGaps(phases,7),[{startYear:1,endYear:1},{startYear:4,endYear:7}]);
});
