"use client";
import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { defaultPreferences, STORAGE_KEY, type Preferences } from './preferences.ts';
import { MAX_CONFIGURATIONS, MAX_NAME_LENGTH, persistedPreferences, readStoredPreferences, snapshotConfiguration, validConfiguration, type PersistedPreferences, type SavedConfiguration } from './configurations.ts';

export type SaveResult = 'saved' | 'invalidName' | 'invalidConfiguration' | 'duplicate' | 'limit' | 'storageError';
type Store = Preferences & {
  savedConfigs: SavedConfiguration[];
  activeConfigId: string | null;
  update: (patch: Partial<Preferences> | ((state: Preferences) => Partial<Preferences>)) => void;
  resetPlan: () => void;
  saveConfiguration: (name: string, replaceId?: string) => SaveResult;
  loadConfiguration: (id: string) => boolean;
  deleteConfiguration: (id: string) => boolean;
};
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function createPreferencesStore(getStorage: () => BrowserStorage | undefined) {
  const latest = () => {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return readStoredPreferences(JSON.parse(raw)); } catch { return null; }
  };
  const write = (state: PersistedPreferences) => {
    try {
      const target = getStorage();
      if (!target) return false;
      target.setItem(STORAGE_KEY,JSON.stringify({state,version:2}));
      return true;
    } catch { return false; }
  };
  const storage: PersistStorage<PersistedPreferences> = {
    getItem: name => {
      try {
        const raw = getStorage()?.getItem(name);
        if (!raw) return null;
        const state = readStoredPreferences(JSON.parse(raw));
        if (!state) return null;
        write(state);
        return {state,version:2};
      } catch { return null; }
    },
    // Draft edits also pass through middleware. Never write a stale library
    // over configurations saved or deleted in another open tab.
    setItem: (_name,value) => { try { write({...value.state,savedConfigs:latest()?.savedConfigs ?? []}); } catch { /* Keep the draft usable. */ } },
    removeItem: name => { try { getStorage()?.removeItem(name); } catch { /* Preferences are optional. */ } },
  };
  return create<Store>()(persist<Store, [], [], PersistedPreferences>((set,get) => ({
    ...defaultPreferences(), savedConfigs:[], activeConfigId:null,
    update: patch => set(state => typeof patch === 'function' ? patch(state) : patch),
    resetPlan: () => set({...snapshotConfiguration(defaultPreferences()),activeConfigId:null}),
    saveConfiguration: (input,replaceId) => {
      const name = input.trim();
      if (!name || name.length > MAX_NAME_LENGTH) return 'invalidName';
      const state = get();
      if (!validConfiguration(state)) return 'invalidConfiguration';
      let library: SavedConfiguration[];
      try { library = latest()?.savedConfigs ?? []; } catch { return 'storageError'; }
      const duplicate = library.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (duplicate && duplicate.id !== replaceId) {set({savedConfigs:library});return 'duplicate';}
      const existing = library.find(item => item.id === replaceId);
      if (!existing && library.length >= MAX_CONFIGURATIONS) return 'limit';
      const item: SavedConfiguration = {id:existing?.id ?? crypto.randomUUID(), name, updatedAt:new Date().toISOString(), configuration:snapshotConfiguration(state)};
      const savedConfigs = [item,...library.filter(saved => saved.id !== item.id)];
      if (!write(persistedPreferences({...state,savedConfigs}))) return 'storageError';
      set({savedConfigs,activeConfigId:item.id});
      return 'saved';
    },
    loadConfiguration: id => {
      let library: SavedConfiguration[];
      try { library = latest()?.savedConfigs ?? []; } catch { return false; }
      const item = library.find(saved => saved.id === id);
      if (!item) return false;
      set({...snapshotConfiguration(item.configuration),savedConfigs:library,activeConfigId:id});
      return true;
    },
    deleteConfiguration: id => {
      const state = get();
      let library: SavedConfiguration[];
      try { library = latest()?.savedConfigs ?? []; } catch { return false; }
      const savedConfigs = library.filter(saved => saved.id !== id);
      if (!write(persistedPreferences({...state,savedConfigs}))) return false;
      set({savedConfigs,activeConfigId:state.activeConfigId === id ? null : state.activeConfigId});
      return true;
    },
  }), {
    name:STORAGE_KEY, version:2, storage, skipHydration:true,
    partialize:persistedPreferences,
    merge:(saved,current) => ({...current,...readStoredPreferences({state:saved,version:2})}),
  }));
}
export const usePreferences = createPreferencesStore(() => typeof window === 'undefined' ? undefined : window.localStorage);
