import type { AppState } from '../learning/types';
import { emptyState, migrate } from './schema';

/**
 * Whole-document persistence: the entire app state is written as one record, so a
 * reward and the completion that earned it are always saved together (atomically).
 * Order of preference: IndexedDB → localStorage → memory only (progress not kept).
 */
export type StorageMode = 'indexeddb' | 'localstorage' | 'memory';

const DB = 'mathbee-coach';
const STORE = 'kv';
const KEY = 'app';
const LS_KEY = 'mathbee-coach:app';
/**
 * Synchronous journal of the latest state, kept in sessionStorage until the async
 * IndexedDB write commits. A reload right after a tap can abort that write; the journal
 * survives the reload and is replayed on load.
 */
const JOURNAL_KEY = 'mathbee-coach:journal';

function journalWrite(value: string) {
  try { sessionStorage.setItem(JOURNAL_KEY, value); } catch { /* storage full or blocked: IndexedDB still gets the write */ }
}
function journalRead(): string | null {
  try { return sessionStorage.getItem(JOURNAL_KEY); } catch { return null; }
}
function journalClear(ifValue: string) {
  try { if (sessionStorage.getItem(JOURNAL_KEY) === ifValue) sessionStorage.removeItem(JOURNAL_KEY); } catch { /* ignore */ }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

function idbGet(db: IDBDatabase): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export class Persistence {
  mode: StorageMode = 'memory';
  lastError: string | null = null;
  private db: IDBDatabase | null = null;
  private pending: string | null = null;
  private writing = false;

  async load(): Promise<AppState> {
    try {
      this.db = await openDb();
      const raw = await idbGet(this.db);
      this.mode = 'indexeddb';
      const pending = journalRead();
      if (pending) {
        const state = migrate(JSON.parse(pending));
        void this.save(state);
        return state;
      }
      if (typeof raw === 'string') return migrate(JSON.parse(raw));
      // first run with IndexedDB: pick up anything saved by the localStorage fallback
      const ls = safeLocalGet();
      return ls ? migrate(JSON.parse(ls)) : emptyState();
    } catch (e) {
      this.db = null;
      this.lastError = String(e);
    }
    try {
      const raw = safeLocalGet();
      localStorage.setItem('mathbee-coach:probe', '1');
      localStorage.removeItem('mathbee-coach:probe');
      this.mode = 'localstorage';
      return raw ? migrate(JSON.parse(raw)) : emptyState();
    } catch (e) {
      this.lastError = String(e);
      this.mode = 'memory';
      return emptyState();
    }
  }

  /** Serialise once and write the whole document; overlapping saves collapse to the latest. */
  async save(state: AppState): Promise<void> {
    if (this.mode === 'memory') return;
    this.pending = JSON.stringify(state);
    if (this.mode === 'indexeddb') journalWrite(this.pending);
    if (this.writing) return;
    this.writing = true;
    try {
      while (this.pending !== null) {
        const value = this.pending;
        this.pending = null;
        if (this.mode === 'indexeddb' && this.db) {
          await idbPut(this.db, value);
          journalClear(value);
        } else localStorage.setItem(LS_KEY, value);
      }
      this.lastError = null;
    } catch (e) {
      this.lastError = String(e);
      // fall back rather than lose progress
      if (this.mode === 'indexeddb') {
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(state));
          this.mode = 'localstorage';
        } catch {
          this.mode = 'memory';
        }
      }
    } finally {
      this.writing = false;
    }
  }

  async clear(): Promise<void> {
    try { if (this.db) await idbPut(this.db, JSON.stringify(emptyState())); } catch { /* ignore */ }
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    try { sessionStorage.removeItem(JOURNAL_KEY); } catch { /* ignore */ }
  }
}

function safeLocalGet(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}
