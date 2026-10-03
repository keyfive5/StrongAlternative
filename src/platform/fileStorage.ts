// The on-device half of storage.ts, kept free of React Native imports so the
// swap-and-backup logic can be tested under plain Node with a fake filesystem.

export interface Storage {
  read(key: string): Promise<string | null>;
  write(key: string, data: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The slice of expo-file-system this class uses. */
export interface FsModule {
  Paths: { document: { uri: string } };
  Directory: new (uri: string) => { exists: boolean; create(o?: { intermediates?: boolean }): void };
  File: new (uri: string) => FsFile;
}

export interface FsFile {
  exists: boolean;
  text(): Promise<string>;
  write(data: string): void;
  create(o?: { intermediates?: boolean; overwrite?: boolean }): void;
  delete(): void;
  move(to: FsFile): Promise<void> | void;
}

export class FileStorage implements Storage {
  private fs: FsModule;
  private dir: string;

  constructor(fs: FsModule) {
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

  /**
   * Every write and remove runs after the one before it has finished. A save
   * from the debounce timer and a flush when the app is backgrounded can
   * otherwise overlap, and two half-finished swaps of the same file is how a
   * log gets lost.
   */
  private queue: Promise<void> = Promise.resolve();

  private enqueue(job: () => Promise<void>): Promise<void> {
    const next = this.queue.then(job, job);
    this.queue = next.catch(() => {});
    return next;
  }

  /** `move` is asynchronous in this version of expo-file-system; wait for it. */
  private async moveTo(from: FsFile, to: FsFile) {
    if (to.exists) to.delete();
    await from.move(to);
  }

  write(key: string, data: string) {
    return this.enqueue(async () => {
      const tmp = this.file(`${key}.json.tmp`);
      if (tmp.exists) tmp.delete();
      tmp.create({ intermediates: true, overwrite: true });
      tmp.write(data);
      const main = this.file(`${key}.json`);
      // Keep the last good copy until the new one is fully in place.
      if (main.exists) await this.moveTo(main, this.file(`${key}.json.bak`));
      await this.moveTo(tmp, this.file(`${key}.json`));
    });
  }

  remove(key: string) {
    return this.enqueue(async () => {
      for (const name of [`${key}.json`, `${key}.json.bak`, `${key}.json.tmp`]) {
        const f = this.file(name);
        if (f.exists) f.delete();
      }
    });
  }
}

