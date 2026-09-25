import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreferencesStore } from './store.ts';
import { defaultPreferences, STORAGE_KEY } from './preferences.ts';
import { readStoredPreferences, sameConfiguration, snapshotConfiguration } from './configurations.ts';

function memoryStorage() {
  const data = new Map<string,string>();
  let fail = false;
  return {data,block:() => {fail=true;},getItem:(key:string) => data.get(key) ?? null,setItem:(key:string,value:string) => {if(fail) throw new Error('quota');data.set(key,value);},removeItem:(key:string) => {data.delete(key);}};
}
const customPlan = {initial:'25000',rate:'5',compounds:'4',years:'20',timing:'beginning' as const,phases:[{id:'custom',amount:'350',frequency:'12',startYear:'3',endYear:'8'}]};

test('only named snapshots survive reload; draft inputs never enter the persisted root', async () => {
  const storage=memoryStorage(); const store=createPreferencesStore(() => storage);
  store.getState().update({...customPlan,language:'es',theme:'dark',currency:'EUR'});
  assert.equal(store.getState().saveConfiguration('  Retirement  '),'saved');
  const id=store.getState().savedConfigs[0].id;
  store.getState().update({initial:'99999',phases:[]});
  const stored=JSON.parse(storage.data.get(STORAGE_KEY)!);
  for(const key of ['initial','rate','compounds','years','phases','timing','activeConfigId']) assert.equal(key in stored.state,false,key);
  assert.equal(stored.version,2);
  const reloaded=createPreferencesStore(() => storage); await reloaded.persist.rehydrate();
  assert.equal(reloaded.getState().initial,'10000');assert.equal(reloaded.getState().activeConfigId,null);
  assert.equal(reloaded.getState().language,'es');assert.equal(reloaded.getState().theme,'dark');assert.equal(reloaded.getState().currency,'EUR');
  assert.equal(reloaded.getState().savedConfigs[0].name,'Retirement');
  assert.equal(reloaded.getState().loadConfiguration(id),true);
  assert.equal(sameConfiguration(reloaded.getState(),customPlan),true);
  assert.equal(reloaded.getState().language,'es');assert.equal(reloaded.getState().theme,'dark');assert.equal(reloaded.getState().currency,'EUR');
});
test('saving and loading copy nested phases without mutating snapshots', () => {
  const storage=memoryStorage();const store=createPreferencesStore(() => storage);
  store.getState().update(customPlan);store.getState().saveConfiguration('Plan');
  const saved=store.getState().savedConfigs[0];
  assert.notEqual(saved.configuration.phases,store.getState().phases);
  assert.notEqual(saved.configuration.phases[0],store.getState().phases[0]);
  store.getState().loadConfiguration(saved.id);
  assert.notEqual(saved.configuration.phases[0],store.getState().phases[0]);
  store.getState().update({phases:store.getState().phases.map(p=>({...p,amount:'700'}))});
  assert.equal(saved.configuration.phases[0].amount,'350');
});
test('duplicate names require explicit replacement and new names create copies', () => {
  const storage=memoryStorage();const store=createPreferencesStore(() => storage);
  store.getState().saveConfiguration('Plan');const id=store.getState().savedConfigs[0].id;
  store.getState().update({initial:'20000'});
  assert.equal(store.getState().saveConfiguration(' PLAN '),'duplicate');
  assert.equal(store.getState().savedConfigs[0].configuration.initial,'10000');
  assert.equal(store.getState().saveConfiguration('Plan',id),'saved');
  assert.equal(store.getState().savedConfigs.length,1);
  assert.equal(store.getState().savedConfigs[0].configuration.initial,'20000');
  assert.equal(store.getState().saveConfiguration('Alternative'),'saved');
  assert.equal(store.getState().savedConfigs.length,2);
});
test('empty names and invalid drafts cannot be saved', () => {
  const storage=memoryStorage();const store=createPreferencesStore(() => storage);
  assert.equal(store.getState().saveConfiguration('   '),'invalidName');
  assert.equal(store.getState().saveConfiguration('a'.repeat(81)),'invalidName');
  store.getState().update({phases:[{...customPlan.phases[0],endYear:'1'}]});
  assert.equal(store.getState().saveConfiguration('Invalid'),'invalidConfiguration');
  assert.equal(store.getState().savedConfigs.length,0);
});
test('reset retains saved plans and preferences; deleting does not change the working draft', async () => {
  const storage=memoryStorage();const store=createPreferencesStore(() => storage);
  store.getState().update({...customPlan,language:'es',currency:'EUR',theme:'dark'});store.getState().saveConfiguration('Plan');
  const id=store.getState().savedConfigs[0].id;
  store.getState().resetPlan();
  assert.equal(sameConfiguration(store.getState(),defaultPreferences()),true);
  assert.equal(store.getState().savedConfigs.length,1);assert.equal(store.getState().language,'es');
  store.getState().loadConfiguration(id);assert.equal(store.getState().deleteConfiguration(id),true);
  assert.equal(sameConfiguration(store.getState(),customPlan),true);assert.equal(store.getState().activeConfigId,null);
  const reloaded=createPreferencesStore(() => storage);await reloaded.persist.rehydrate();
  assert.equal(reloaded.getState().savedConfigs.length,0);
});
test('failed storage writes do not claim success or replace/delete a saved plan', () => {
  const storage=memoryStorage();const store=createPreferencesStore(() => storage);
  store.getState().saveConfiguration('Plan');const original=store.getState().savedConfigs[0];
  storage.block();store.getState().update({initial:'12345'});
  assert.equal(store.getState().saveConfiguration('Plan',original.id),'storageError');
  assert.deepEqual(store.getState().savedConfigs,[original]);
  assert.equal(store.getState().deleteConfiguration(original.id),false);
  assert.equal(store.getState().savedConfigs.length,1);
  assert.equal(createPreferencesStore(() => undefined).getState().saveConfiguration('Plan'),'storageError');
});
test('legacy custom autosaves migrate once into a recoverable named plan, including unfinished edits', async () => {
  const storage=memoryStorage();
  const previous={...defaultPreferences(),...customPlan,language:'es',phases:[{...customPlan.phases[0],amount:'',startYear:'9',endYear:'8'}]};
  storage.setItem(STORAGE_KEY,JSON.stringify({version:1,state:previous}));
  const store=createPreferencesStore(() => storage);await store.persist.rehydrate();
  assert.equal(store.getState().initial,'10000');assert.equal(store.getState().savedConfigs.length,1);
  assert.equal(store.getState().savedConfigs[0].name,'Configuración anterior');
  assert.equal(sameConfiguration(store.getState().savedConfigs[0].configuration,previous),true);
  store.getState().deleteConfiguration('previous-configuration');
  const reloaded=createPreferencesStore(() => storage);await reloaded.persist.rehydrate();
  assert.equal(reloaded.getState().savedConfigs.length,0);
  assert.equal(readStoredPreferences({version:1,state:defaultPreferences()})?.savedConfigs.length,0);
});
test('malformed saved entries are isolated and unexpected draft roots are ignored', () => {
  const valid={id:'one',name:'Plan',updatedAt:'2026-09-25T00:00:00Z',configuration:snapshotConfiguration(defaultPreferences())};
  const restored=readStoredPreferences({version:2,state:{language:'es',initial:'12345',savedConfigs:[null,valid,{...valid,id:'two'},{...valid,name:'Other',configuration:{phases:[null]}}]}})!;
  assert.equal(restored.savedConfigs.length,1);assert.equal('initial' in restored,false);assert.equal(restored.language,'es');
  assert.equal(readStoredPreferences({version:3,state:{}}),null);
});
test('stale tabs preserve plans saved or deleted elsewhere when editing, saving, or deleting', async () => {
  const storage=memoryStorage();const a=createPreferencesStore(() => storage);const b=createPreferencesStore(() => storage);
  await a.persist.rehydrate();await b.persist.rehydrate();
  a.getState().saveConfiguration('Plan A');
  const firstId=a.getState().savedConfigs[0].id;
  b.getState().update({initial:'12000'});
  assert.equal(JSON.parse(storage.data.get(STORAGE_KEY)!).state.savedConfigs.length,1);
  assert.equal(b.getState().saveConfiguration('Plan B'),'saved');
  assert.equal(b.getState().savedConfigs.length,2);
  a.getState().deleteConfiguration(firstId);
  b.getState().update({initial:'15000'});
  const reloaded=createPreferencesStore(() => storage);await reloaded.persist.rehydrate();
  assert.deepEqual(reloaded.getState().savedConfigs.map(item=>item.name),['Plan B']);
});

test('saving changes updates the active identity and leaves appearance preferences out of dirty state', () => {
  const storage=memoryStorage();const store=createPreferencesStore(()=>storage);
  store.getState().update(customPlan);store.getState().saveConfiguration('Retirement');
  const original=store.getState().savedConfigs[0];
  store.getState().update({language:'es',theme:'dark',currency:'EUR',view:'table'});
  assert.equal(sameConfiguration(store.getState(),original.configuration),true);
  store.getState().update({initial:'45000'});
  assert.equal(sameConfiguration(store.getState(),original.configuration),false);
  assert.equal(store.getState().updateActiveConfiguration(),'saved');
  assert.equal(store.getState().savedConfigs.length,1);
  assert.equal(store.getState().activeConfigId,original.id);
  assert.equal(store.getState().savedConfigs[0].name,'Retirement');
  assert.equal(store.getState().savedConfigs[0].configuration.initial,'45000');
  assert.equal(sameConfiguration(store.getState(),store.getState().savedConfigs[0].configuration),true);
  store.getState().update({initial:'90000',phases:[]});
  assert.equal(store.getState().loadConfiguration(original.id),true);
  assert.equal(store.getState().initial,'45000');
  assert.equal(store.getState().phases.length,1);
  assert.equal(store.getState().activeConfigId,original.id);
  assert.equal(store.getState().currency,'EUR');
  store.getState().resetPlan();
  assert.equal(store.getState().activeConfigId,null);
  assert.equal(store.getState().savedConfigs.length,1);
});

test('active updates preserve drafts on failure and never recreate a deleted plan', () => {
  const storage=memoryStorage();const a=createPreferencesStore(()=>storage);const b=createPreferencesStore(()=>storage);
  a.getState().saveConfiguration('Plan');const original=a.getState().savedConfigs[0];
  a.getState().update({initial:'45678'});
  b.getState().deleteConfiguration(original.id);
  assert.equal(a.getState().updateActiveConfiguration(),'missing');
  assert.equal(a.getState().initial,'45678');
  assert.equal(a.getState().activeConfigId,null);
  assert.equal(a.getState().savedConfigs.length,0);
  assert.equal(a.getState().saveConfiguration('Plan',original.id),'missing');
  assert.equal(a.getState().saveConfiguration('Recovered plan'),'saved');
  const recovered=a.getState().savedConfigs[0];
  a.getState().update({initial:'56789'});storage.block();
  assert.equal(a.getState().updateActiveConfiguration(),'storageError');
  assert.equal(a.getState().initial,'56789');
  assert.equal(a.getState().activeConfigId,recovered.id);
  assert.deepEqual(a.getState().savedConfigs,[recovered]);
});

test('updating a stale active plan retains its latest saved name', () => {
  const storage=memoryStorage();const a=createPreferencesStore(()=>storage);const b=createPreferencesStore(()=>storage);
  a.getState().saveConfiguration('Original name');const id=a.getState().activeConfigId!;
  b.getState().loadConfiguration(id);b.getState().saveConfiguration('Renamed plan',id);
  a.getState().update({initial:'20000'});
  assert.equal(a.getState().updateActiveConfiguration(),'saved');
  assert.equal(a.getState().savedConfigs[0].id,id);
  assert.equal(a.getState().savedConfigs[0].name,'Renamed plan');
});
