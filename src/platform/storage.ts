// Durable key → text storage.
//
// On device each key is a JSON file in the app's documents folder. A save
// writes a temporary file first and then swaps it in, and the previous good
// copy is kept as `<key>.bak`, so a crash mid-write can never leave the log
// half-written. On web (development and screenshots) it is localStorage.

import { Platform } from 'react-native';
import { FileStorage } from './fileStorage.ts';

import type { FsModule, Storage } from './fileStorage.ts';

export type { Storage };

class WebStorage implements Storage {
  async read(key: string) {
    try {
      return globalThis.localStorage?.getItem('overload.' + key) ?? null;
    } catch {
      return null;
    }
  }
  async write(key: string, data: string) {
    try {
      globalThis.localStorage?.setItem('overload.' + key, data);
    } catch {
      // Private browsing or a full quota; the session keeps working in memory.
    }
  }
  async remove(key: string) {
    try {
      globalThis.localStorage?.removeItem('overload.' + key);
    } catch {}
  }
}

let cached: Storage | null = null;

export function storage(): Storage {
  if (cached) return cached;
  if (Platform.OS === 'web') cached = new WebStorage();
  else {
    // Lazy: expo-file-system's native module does not exist in a web bundle.
    cached = new FileStorage(require('expo-file-system') as FsModule);
  }
  return cached;
}
