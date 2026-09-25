import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultPreferences, sanitizePreferences } from './preferences.ts';
import { messages, translator } from './i18n.ts';
import { contributionGaps } from './compound.ts';
test('defaults are English, system theme, and USD', () => {
  const p=defaultPreferences(); assert.equal(p.language,'en'); assert.equal(p.theme,'system'); assert.equal(p.currency,'USD');
});
test('valid preferences and explicit contribution windows survive a storage round trip', () => {
  const original={...defaultPreferences(),language:'es',theme:'dark',currency:'EUR',years:'20',phases:[{id:'custom',amount:'250',frequency:'4',startYear:'3',endYear:'8'}]};
  const restored=sanitizePreferences(JSON.parse(JSON.stringify(original)));
  assert.equal(restored.language,'es');assert.equal(restored.theme,'dark');assert.equal(restored.currency,'EUR');assert.equal(restored.years,'20');
  assert.equal(restored.phases[0].startYear,'3');assert.equal(restored.phases[0].endYear,'8');
  assert.deepEqual(sanitizePreferences({...original,phases:[]}).phases,[]);
});
test('malformed or obsolete preferences fall back safely', () => {
  for(const bad of [null,undefined,42,'bad',[],{language:'fr',theme:'pink',currency:'GBP',initial:'Infinity',years:'500',phases:[null],visible:{total:'yes'}}]) assert.deepEqual(sanitizePreferences(bad),defaultPreferences());
  assert.equal(sanitizePreferences({language:'es',currency:'CAD'}).language,'es');
  assert.equal(sanitizePreferences({language:'es',currency:'CAD'}).currency,'USD');
});
test('unfinished phase edits survive reload without replacing other phases', () => {
  const phases = [{id:'a',amount:'',frequency:'12',startYear:'8',endYear:'3'}, {id:'b',amount:'300',frequency:'4',startYear:'10',endYear:'15'}];
  const restored = sanitizePreferences(JSON.parse(JSON.stringify({...defaultPreferences(),phases})));
  assert.equal(restored.phases.length,2);
  assert.equal(restored.phases[0].amount,'');
  assert.equal(restored.phases[0].startYear,'8');
  assert.equal(restored.phases[0].endYear,'3');
  assert.equal(restored.phases[1].amount,'300');
  assert.equal(restored.phases[1].endYear,'15');
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
