import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createPreferencesStore, type AccountTransport } from './store.ts';
import { defaultPreferences } from './preferences.ts';
import { sameConfiguration, snapshotConfiguration } from './configurations.ts';
import { AccountError, mutationSchema, type AccountMutation } from './account.ts';
import { mutateAccount, readAccount } from '../db/repository.ts';

function database() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_nosy_anita_blake.sql',import.meta.url),'utf8'));
  const prepare=(sql:string)=>{
    let params:unknown[]=[];
    const statement={bind:(...values:unknown[])=>{params=values;return statement;},
      first:async()=>sqlite.prepare(sql).get(...params as never[])??null,
      run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...params as never[]).changes)}}),
      all:async()=>({results:sqlite.prepare(sql).all(...params as never[])})};
    return statement;
  };
  const db={prepare,batch:async(statements:ReturnType<typeof prepare>[])=>Promise.all(statements.map(s=>s.all()))} as unknown as D1Database;
  const transport=(user:string):AccountTransport=>async change=>{const saved=change?await mutateAccount(db,user,mutationSchema.parse(change)):undefined;return {...await readAccount(db,user),...(saved?{saved}:{})};};
  return {db,transport};
}
const newPlan=(name='Plan'):AccountMutation=>({action:'save',id:crypto.randomUUID(),name,configuration:snapshotConfiguration(defaultPreferences())});

test('accounts isolate plans and settings; names may repeat across users',async()=>{
  const {db}=database();const a=newPlan();await mutateAccount(db,'alice',a);await mutateAccount(db,'bob',newPlan());
  await mutateAccount(db,'alice',{action:'preferences',patch:{theme:'dark',currency:'EUR'}});
  assert.equal((await readAccount(db,'bob')).preferences.theme,'system');
  assert.equal((await readAccount(db,'alice')).preferences.currency,'EUR');
  if(a.action!=='save')throw Error();
  await assert.rejects(mutateAccount(db,'bob',{...a,revision:1,name:'Stolen'}),{code:'missing'});
  await mutateAccount(db,'bob',{action:'delete',id:a.id,revision:1});
  assert.equal((await readAccount(db,'alice')).savedConfigs.length,1);
  assert.notEqual((await readAccount(db,'bob')).savedConfigs[0].id,a.id);
});
test('database enforces case-insensitive names, limits and retry-safe creation',async()=>{
  const {db}=database();const p=newPlan('Álvaro');await mutateAccount(db,'a',p);await mutateAccount(db,'a',p);
  await assert.rejects(mutateAccount(db,'a',newPlan('álvaro')),{code:'duplicate'});
  for(let i=1;i<50;i++)await mutateAccount(db,'a',newPlan('Plan '+i));
  const results=await Promise.allSettled([mutateAccount(db,'a',newPlan('Overflow')),mutateAccount(db,'a',newPlan('Overflow 2'))]);
  assert.ok(results.every(r=>r.status==='rejected'));
  assert.equal((await readAccount(db,'a')).savedConfigs.length,50);
});
test('simultaneous inserts cannot exceed the plan limit or duplicate names',async()=>{
  const {db}=database();for(let i=0;i<49;i++)await mutateAccount(db,'a',newPlan('Plan '+i));
  const results=await Promise.allSettled([mutateAccount(db,'a',newPlan('Last')),mutateAccount(db,'a',newPlan('Other'))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const duplicate=await Promise.allSettled([mutateAccount(db,'b',newPlan('Same')),mutateAccount(db,'b',newPlan('same'))]);
  assert.equal(duplicate.filter(r=>r.status==='fulfilled').length,1);
});
test('updates and deletes reject stale revisions and cannot resurrect deleted plans',async()=>{
  const {db}=database();const p=newPlan();if(p.action!=='save')throw Error();await mutateAccount(db,'a',p);
  const changed={...p,revision:1,configuration:{...p.configuration,initial:'12345'}};
  const results=await Promise.allSettled([mutateAccount(db,'a',changed),mutateAccount(db,'a',{...changed,configuration:{...p.configuration,initial:'99999'}})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(mutateAccount(db,'a',{action:'delete',id:p.id,revision:1}),{code:'conflict'});
  await mutateAccount(db,'a',{action:'delete',id:p.id,revision:2});
  await assert.rejects(mutateAccount(db,'a',changed),{code:'missing'});
});
test('strict payload validation rejects invalid configurations and client-controlled owners',()=>{
  const p=newPlan();
  for(const bad of [null,{}, {...p,userId:'victim'}, {...p,name:' '}, {...p,name:'x'.repeat(81)}, {...p,configuration:{phases:[null]}}, {...p,configuration:{...defaultPreferences(),years:'999'}}, {action:'preferences',patch:{currency:'GBP'}}, {action:'preferences',patch:{user_id:'other'}}])assert.equal(mutationSchema.safeParse(bad).success,false);
  assert.equal(mutationSchema.safeParse(p).success,true);
});
test('only named snapshots persist; preference writes do not persist calculator drafts',async()=>{
  const {transport}=database();const s=createPreferencesStore(transport('a'));await s.getState().refresh();
  s.getState().update({initial:'25000',language:'es',theme:'dark'});assert.equal(await s.getState().saveConfiguration('Plan'),'saved');
  assert.equal(sameConfiguration(s.getState(),s.getState().activeSnapshot!.configuration),true);
  s.getState().update({initial:'99999',phases:[]});
  const next=createPreferencesStore(transport('a'));await next.getState().refresh();
  assert.equal(next.getState().initial,'10000');assert.equal(next.getState().language,'es');assert.equal(next.getState().theme,'dark');
  await next.getState().loadConfiguration(s.getState().activeConfigId!);assert.equal(next.getState().initial,'25000');
});
test('phase clipping and reset retain saved snapshots',async()=>{
  const {transport}=database();const s=createPreferencesStore(transport('a'));await s.getState().refresh();await s.getState().saveConfiguration('Plan');const original=s.getState().activeSnapshot!;
  s.getState().update({years:'7'});assert.equal(s.getState().phases[2].endYear,'7');assert.equal(original.configuration.phases[2].endYear,'10');
  s.getState().update({years:'1'});assert.ok(s.getState().phases.every(p=>p.startYear==='1'&&p.endYear==='1'));
  await s.getState().loadConfiguration(original.id);assert.equal(s.getState().phases[2].endYear,'10');
  s.getState().resetPlan();assert.equal(s.getState().savedConfigs.length,1);assert.equal(s.getState().activeSnapshot,null);
});
test('focus refresh cannot replace the revision of the loaded draft',async()=>{
  const {transport}=database();const a=createPreferencesStore(transport('a'));const b=createPreferencesStore(transport('a'));
  await a.getState().refresh();await a.getState().saveConfiguration('Plan');await b.getState().loadConfiguration(a.getState().activeConfigId!);
  a.getState().update({initial:'20000'});await a.getState().updateActiveConfiguration();
  b.getState().update({initial:'30000'});await b.getState().refresh();
  assert.equal(b.getState().activeSnapshot!.revision,1);assert.equal(b.getState().savedConfigs[0].revision,2);
  assert.equal(await b.getState().updateActiveConfiguration(),'conflict');assert.equal(b.getState().initial,'30000');
  assert.equal(await b.getState().saveConfiguration('My copy'),'saved');
});
test('edits during an asynchronous save remain dirty; failed writes preserve drafts',async()=>{
  const {transport}=database();let release:()=>void=()=>{};let delay=false;let fail=false;
  const s=createPreferencesStore(async change=>{if(fail)throw new AccountError('storageError');if(change&&delay)await new Promise<void>(r=>{release=r;});return transport('a')(change);});
  await s.getState().refresh();delay=true;const saving=s.getState().saveConfiguration('Plan');await new Promise(r=>setImmediate(r));s.getState().update({initial:'45678'});release();await saving;
  assert.equal(s.getState().activeSnapshot!.configuration.initial,'10000');assert.equal(sameConfiguration(s.getState(),s.getState().activeSnapshot!.configuration),false);
  fail=true;assert.equal(await s.getState().updateActiveConfiguration(),'storageError');assert.equal(await s.getState().deleteConfiguration(s.getState().activeConfigId!),false);
  assert.equal(s.getState().initial,'45678');assert.equal(s.getState().savedConfigs.length,1);
});
test('rapid preference writes and retry preserve latest intent and other devices fields',async()=>{
  const {transport}=database();let fail=false;const s=createPreferencesStore(async c=>{if(fail)throw Error();return transport('a')(c);});await s.getState().refresh();
  s.getState().update({theme:'dark'});s.getState().update({theme:'light',language:'es'});await s.getState().retry();
  await transport('a')({action:'preferences',patch:{currency:'EUR'}});fail=true;s.getState().update({theme:'dark'});await s.getState().refresh();fail=false;await s.getState().retry();
  const data=await transport('a')();assert.equal(data.preferences.theme,'dark');assert.equal(data.preferences.language,'es');assert.equal(data.preferences.currency,'EUR');
});

test('failed preference writes remain visible after an unrelated successful refresh',async()=>{
  const {transport}=database();let fail=true;
  const s=createPreferencesStore(async c=>{if(c?.action==='preferences'&&fail)throw Error('offline');return transport('a')(c);});
  await s.getState().refresh();s.getState().update({theme:'dark'});await s.getState().refresh();
  assert.equal(s.getState().settingsError,'storageError');assert.equal(s.getState().theme,'dark');
  fail=false;await s.getState().retry();assert.equal(s.getState().settingsError,null);assert.equal((await transport('a')()).preferences.theme,'dark');
});
test('remote deletion clears active identity while preserving a recoverable draft',async()=>{
  const {transport}=database();const s=createPreferencesStore(transport('a'));await s.getState().refresh();await s.getState().saveConfiguration('Plan');const item=s.getState().activeSnapshot!;
  s.getState().update({initial:'45678'});await transport('a')({action:'delete',id:item.id,revision:item.revision});await s.getState().refresh();
  assert.equal(s.getState().activeSnapshot,null);assert.equal(s.getState().activeConfigId,null);assert.equal(s.getState().initial,'45678');
});
