/**
 * Where the persisted state lives. The browser build keeps it in
 * localStorage; the desktop build swaps in a file-backed storage before the
 * core starts (src/app/platform/desktop.ts). PersistenceManager only sees
 * this interface.
 */
export interface StateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Reads the global localStorage on every call, so tests can mock it. */
const browserStorage: StateStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

let current: StateStorage = browserStorage;

export function getStateStorage(): StateStorage {
  return current;
}

/** Replaces the storage for every PersistenceManager created afterwards and in use. */
export function setStateStorage(storage: StateStorage): void {
  current = storage;
}
