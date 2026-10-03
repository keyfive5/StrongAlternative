// Durable key → text storage.
//
// On device each key is a JSON file in the app's documents folder. A save
// writes a temporary file first and then swaps it in, and the previous good
// copy is kept as `<key>.bak`, so a crash mid-write can never leave the log
// half-written. On web (development and screenshots) it is localStorage.

import { Platform } from 'react-native';

export interface Storage {
  read(key: string): Promise<string | null>;
  write(key: string, data: string): Promise<void>;
  remove(key: string): Promise<void>;
}

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

class FileStorage implements Storage {
  private fs: typeof import('expo-file-system');
  private dir: string;

  constructor(fs: typeof import('expo-file-system')) {
    this.fs = fs;
    this.dir = fs.Paths.document.uri.replace(/\/$/, '') + '/overload';
    const d = new fs.Directory(this.dir);
    if (!d.exists) d.create({ intermediates: true });
  }

  private file(name: string) {
    return new this.fs.File(`${this.dir}/${name}`);
  }

  async read(key: string) {
    for (const name of [`${key}.json`, `${key}.json.bak`]) {
      const f = this.file(name);
      if (!f.exists) continue;
      const text = await f.text();
      // A truncated file fails to parse; fall through to the backup.
      try {
        JSON.parse(text);
        return text;
      } catch {}
    }
    return null;
  }

  async write(key: string, data: string) {
    const tmp = this.file(`${key}.json.tmp`);
    if (tmp.exists) tmp.delete();
    tmp.create({ intermediates: true, overwrite: true });
    tmp.write(data);
    const main = this.file(`${key}.json`);
    const bak = this.file(`${key}.json.bak`);
    if (main.exists) {
      if (bak.exists) bak.delete();
      main.move(bak);
    }
    tmp.move(this.file(`${key}.json`));
  }

  async remove(key: string) {
    for (const name of [`${key}.json`, `${key}.json.bak`, `${key}.json.tmp`]) {
      const f = this.file(name);
      if (f.exists) f.delete();
    }
  }
}

let cached: Storage | null = null;

export function storage(): Storage {
  if (cached) return cached;
  if (Platform.OS === 'web') cached = new WebStorage();
  else {
    // Lazy: expo-file-system's native module does not exist in a web bundle.
    cached = new FileStorage(require('expo-file-system') as typeof import('expo-file-system'));
  }
  return cached;
}
