"use client";
import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { defaultPreferences, sanitizePreferences, STORAGE_KEY, type Preferences } from './preferences';
type Store = Preferences & {
  update: (patch: Partial<Preferences> | ((state: Preferences) => Partial<Preferences>)) => void;
  resetPlan: () => void;
};
const storage: PersistStorage<Preferences> = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name);
      if (!raw) return null;
      const data: unknown = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !('state' in data) || !('version' in data) || data.version !== 1) return null;
      return { state: sanitizePreferences(data.state), version: 1 };
    } catch { return null; }
  },
  setItem: (name, value) => { try { window.localStorage.setItem(name, JSON.stringify(value)); } catch { /* Storage may be unavailable; the calculator still works. */ } },
  removeItem: (name) => { try { window.localStorage.removeItem(name); } catch { /* Nonpersistent sessions are supported. */ } },
};
export const usePreferences = create<Store>()(persist((set) => ({
  ...defaultPreferences(),
  update: (patch) => set(state => typeof patch === 'function' ? patch(state) : patch),
  resetPlan: () => set(state => ({ ...defaultPreferences(), language: state.language, theme: state.theme, currency: state.currency })),
}), {
  name: STORAGE_KEY, version: 1, storage, skipHydration: true,
  partialize: ({ update: _update, resetPlan: _reset, ...preferences }) => preferences,
  merge: (saved, current) => ({ ...current, ...sanitizePreferences(saved) }),
}));
