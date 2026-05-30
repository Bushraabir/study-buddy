
// Local IndexedDB cache for CAS (SymPy) analysis results.
// Named casCache (not db) to avoid collision with Firebase's db export.
// Results are keyed by expression string — purely derived data, no sync needed.

const DB_NAME = 'StudyBuddyCAS';
const DB_VERSION = 1;
const STORE = 'analysis';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
  });
}

export const casCache = {
  async get(key) {
    try {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result?.value ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null; // Never crash the graph
    }
  },

  async set(key, value) {
    try {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, 'readwrite');
        const req = tx.objectStore(STORE).put({ key, value, ts: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {} // Silently fail — CAS is enhancement-only
  },

  async clear() {
    try {
      const database = await openDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, 'readwrite');
        const req = tx.objectStore(STORE).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
  },
};