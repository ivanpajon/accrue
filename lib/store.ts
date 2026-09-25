"use client";
import { create } from 'zustand';
import { defaultPreferences, type Preferences } from './preferences.ts';
import { fitPhasesToHorizon } from './phase-range.ts';
import { MAX_NAME_LENGTH, snapshotConfiguration, validConfiguration, type SavedConfiguration } from './configurations.ts';
import { AccountError, type AccountErrorCode, type AccountData, type AccountMutation, type AccountSettings } from './account.ts';

export type SaveResult = 'saved' | AccountErrorCode;
export type AccountTransport = (change?:AccountMutation) => Promise<AccountData>;
type Store = Preferences & {
  savedConfigs:SavedConfiguration[]; activeConfigId:string|null; activeSnapshot:SavedConfiguration|null;
  ready:boolean; pending:number; accountError:AccountErrorCode|null; settingsError:AccountErrorCode|null;
  refresh:()=>Promise<void>; retry:()=>Promise<void>;
  update:(patch:Partial<Preferences>|((state:Preferences)=>Partial<Preferences>))=>void;
  resetPlan:()=>void;
  saveConfiguration:(name:string,replaceId?:string)=>Promise<SaveResult>;
  updateActiveConfiguration:()=>Promise<SaveResult>;
  loadConfiguration:(id:string)=>Promise<boolean>;
  deleteConfiguration:(id:string)=>Promise<boolean>;
};
const settingKeys=['language','theme','currency','view','visible'] as const;
export const fetchAccount:AccountTransport = async change => {
  const response=await fetch('/api/account',{method:change?'POST':'GET',credentials:'same-origin',cache:'no-store',
    headers:change?{'Content-Type':'application/json'}:undefined,body:change?JSON.stringify(change):undefined,signal:AbortSignal.timeout(15000)});
  const data=await response.json() as AccountData & {error?:AccountErrorCode};
  if(!response.ok) throw new AccountError(data.error ?? 'storageError');
  return data;
};
export function createPreferencesStore(transport:AccountTransport=fetchAccount) {
  let queue:Promise<unknown>=Promise.resolve();
  let unsynced:Partial<AccountSettings>={};
  let settingsGeneration=0;
  // Retain the UUID of an uncertain create so a manual retry cannot duplicate it.
  let pendingCreate:{fingerprint:string;id:string}|null=null;
  return create<Store>()((set,get)=>{
    function enqueue<T>(work:()=>Promise<T>):Promise<T> {
      set(state=>({pending:state.pending+1}));
      const task=queue.then(work);
      queue=task.catch(()=>{}).finally(()=>set(state=>({pending:state.pending-1})));
      return task;
    }
    function accept(data:AccountData,generation:number) {
      const removed=get().activeConfigId && !data.savedConfigs.some(p=>p.id===get().activeConfigId);
      set({savedConfigs:data.savedConfigs,ready:true,...(removed?{activeConfigId:null,activeSnapshot:null}:{}),...(generation===settingsGeneration?{...data.preferences,...unsynced}:{})});
    }
    function report(error:unknown):AccountErrorCode {
      const code=error instanceof AccountError?error.code:'storageError';
      set({accountError:code,...(code==='unauthorized'?{ready:false,savedConfigs:[],activeConfigId:null,activeSnapshot:null}:{})});
      return code;
    }
    async function refresh() {
      return enqueue(async()=>{const generation=settingsGeneration;try{accept(await transport(),generation);set({accountError:null});}catch(error){report(error);}});
    }
    async function syncSettings() {
      return enqueue(async()=>{
        const patch={...unsynced};if(!Object.keys(patch).length)return;
        const generation=settingsGeneration;
        try {
          const data=await transport({action:'preferences',patch});
          if(generation===settingsGeneration)unsynced={};
          accept(data,generation);set({accountError:null,...(generation===settingsGeneration?{settingsError:null}:{})});
        } catch(error){set({settingsError:report(error)});}
      });
    }
    function save(name:string,existing?:SavedConfiguration):Promise<SaveResult> {
      const state=get();name=name.trim();
      if(!state.ready)return Promise.resolve('storageError');
      if(!name||name.length>MAX_NAME_LENGTH)return Promise.resolve('invalidName');
      if(!validConfiguration(state))return Promise.resolve('invalidConfiguration');
      const configuration=snapshotConfiguration(state);
      const fingerprint=JSON.stringify({name,configuration});
      const id=existing?.id ?? (pendingCreate?.fingerprint===fingerprint?pendingCreate.id:crypto.randomUUID());
      if(!existing)pendingCreate={fingerprint,id};
      const change:AccountMutation={action:'save',id,name,configuration,...(existing?{revision:existing.revision}:{})};
      return enqueue(async()=>{
        const generation=settingsGeneration;
        try {
          const data=await transport(change);accept(data,generation);
          const item=data.saved;
          if(!item)throw new AccountError('storageError');
          set({activeConfigId:id,activeSnapshot:item,accountError:null});pendingCreate=null;
          return 'saved';
        } catch(error) {return report(error);}
      });
    }
    return {
      ...defaultPreferences(),savedConfigs:[],activeConfigId:null,activeSnapshot:null,ready:false,pending:0,accountError:null,settingsError:null,
      refresh,
      retry:async()=>{await refresh();if(get().ready)await syncSettings();},
      update:patch=>{
        const state=get();const changes=typeof patch==='function'?patch(state):patch;
        if(changes.years!==undefined||changes.phases!==undefined)changes.phases=fitPhasesToHorizon(changes.phases??state.phases,Number(changes.years??state.years));
        set(changes);
        const settings=Object.fromEntries(settingKeys.filter(key=>key in changes).map(key=>[key,changes[key]])) as Partial<AccountSettings>;
        if(Object.keys(settings).length){unsynced={...unsynced,...settings};settingsGeneration++;void syncSettings();}
      },
      resetPlan:()=>set({...snapshotConfiguration(defaultPreferences()),activeConfigId:null,activeSnapshot:null}),
      saveConfiguration:(name,replaceId)=>{
        const state=get();const existing=replaceId?(state.activeSnapshot?.id===replaceId?state.activeSnapshot:state.savedConfigs.find(p=>p.id===replaceId)):undefined;
        if(replaceId&&!existing)return Promise.resolve('missing');
        return save(name,existing);
      },
      updateActiveConfiguration:()=>{const existing=get().activeSnapshot;return existing?save(existing.name,existing):Promise.resolve('missing');},
      loadConfiguration:id=>enqueue(async()=>{
        const generation=settingsGeneration;
        try {
          const data=await transport();accept(data,generation);
          const item=data.savedConfigs.find(p=>p.id===id);
          if(!item){set({accountError:'missing'});return false;}
          const configuration=snapshotConfiguration(item.configuration);
          set({...configuration,phases:fitPhasesToHorizon(configuration.phases,Number(configuration.years)),activeConfigId:id,activeSnapshot:item,accountError:null});return true;
        } catch(error){report(error);return false;}
      }),
      deleteConfiguration:id=>{
        const item=get().savedConfigs.find(p=>p.id===id);if(!item)return Promise.resolve(false);
        return enqueue(async()=>{const generation=settingsGeneration;try{
          const data=await transport({action:'delete',id,revision:item.revision});accept(data,generation);
          set({accountError:null,...(get().activeConfigId===id?{activeConfigId:null,activeSnapshot:null}:{})});return true;
        }catch(error){report(error);return false;}});
      },
    };
  });
}
export const usePreferences=createPreferencesStore();
