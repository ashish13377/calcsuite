import { useCallback, useSyncExternalStore } from 'react';
import type { Values } from '../core/kit';

export interface HistoryItem {
  id: string; // calculator id
  title: string;
  primary: string; // headline value
  values: Values;
  at: number; // epoch ms (from Date.now at save time — history is UI state, not a money path)
}

const KEY = 'calcsuite:history';
const LIMIT = 100;
const EMPTY: HistoryItem[] = [];

// Single shared store so EVERY component that saves or reads history stays in sync within
// the tab (per-component useState did not — a Save in one panel never reached the History
// view). Backed by localStorage; also syncs across tabs via the storage event.
let cache: HistoryItem[] | null = null;
const listeners = new Set<() => void>();

function read(): HistoryItem[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    cache = [];
  }
  return cache!;
}

function commit(next: HistoryItem[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  listeners.forEach((l) => l());
}

let storageBound = false;
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageBound && typeof window !== 'undefined') {
    storageBound = true;
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) {
        cache = null; // force re-read from localStorage
        listeners.forEach((l) => l());
      }
    });
  }
  return () => listeners.delete(listener);
}

export function saveHistory(item: Omit<HistoryItem, 'at'>): void {
  commit([{ ...item, at: Date.now() }, ...read()].slice(0, LIMIT));
}

export function clearHistory(): void {
  commit([]);
}

export function useHistory() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const save = useCallback((item: Omit<HistoryItem, 'at'>) => saveHistory(item), []);
  const clear = useCallback(() => clearHistory(), []);
  return { items, save, clear };
}
