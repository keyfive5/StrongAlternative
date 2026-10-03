// On-device storage, against a fake filesystem that behaves like
// expo-file-system 57: `move` is asynchronous and refuses to overwrite an
// existing destination. The first version of FileStorage did not await its
// moves, which this fake turns into the lost save it would have been on an
// iPhone.
import { describe, eq, ok, report } from './harness.mjs';
import { FileStorage } from '../src/platform/fileStorage.ts';

function fakeFs() {
  const files = new Map();
  const tick = () => new Promise((r) => setTimeout(r, 1));
  let crashAfterMoves = Infinity;
  let moves = 0;
  class File {
    constructor(uri) {
      this.uri = uri;
    }
    get exists() {
      return files.has(this.uri);
    }
    async text() {
      await tick();
      if (!files.has(this.uri)) throw new Error('missing ' + this.uri);
      return files.get(this.uri);
    }
    write(data) {
      if (!files.has(this.uri)) throw new Error('write to missing file');
      files.set(this.uri, data);
    }
    create() {
      files.set(this.uri, '');
    }
    delete() {
      files.delete(this.uri);
    }
    async move(to) {
      const from = this.uri;
      await tick();
      if (moves >= crashAfterMoves) throw new Error('simulated crash');
      if (!files.has(from)) throw new Error('move: source missing ' + from);
      if (files.has(to.uri)) throw new Error('move: destination exists ' + to.uri);
      files.set(to.uri, files.get(from));
      files.delete(from);
      this.uri = to.uri;
      moves++;
    }
  }
  class Directory {
    constructor() {}
    get exists() {
      return true;
    }
    create() {}
  }
  return {
    mod: { Paths: { document: { uri: 'file:///docs/' } }, File, Directory },
    files,
    crashAfter(n) {
      moves = 0;
      crashAfterMoves = n;
    },
  };
}

await describe('writes', async () => {
  const fs = fakeFs();
  const s = new FileStorage(fs.mod);
  await s.write('db', '{"v":1}');
  eq(await s.read('db'), '{"v":1}', 'first write reads back');
  await s.write('db', '{"v":2}');
  eq(await s.read('db'), '{"v":2}', 'second write replaces the first');
  eq(fs.files.get('file:///docs/overload/db.json.bak'), '{"v":1}', 'the previous copy is kept as a backup');
  ok(!fs.files.has('file:///docs/overload/db.json.tmp'), 'no temp file left behind');
});

await describe('overlapping writes', async () => {
  const fs = fakeFs();
  const s = new FileStorage(fs.mod);
  // The debounce timer and an app-backgrounded flush firing together.
  const all = [1, 2, 3, 4, 5].map((v) => s.write('db', `{"v":${v}}`));
  const results = await Promise.allSettled(all);
  ok(results.every((r) => r.status === 'fulfilled'), 'none of five overlapping writes fails');
  eq(await s.read('db'), '{"v":5}', 'the last write wins');
});

await describe('crash recovery', async () => {
  const fs = fakeFs();
  const s = new FileStorage(fs.mod);
  await s.write('db', '{"v":1}');
  // Die after the old copy is moved aside but before the new one lands.
  fs.crashAfter(1);
  await s.write('db', '{"v":2}').catch(() => {});
  eq(await s.read('db'), '{"v":1}', 'a crash mid-swap falls back to the last good copy');
  fs.crashAfter(Infinity);
  await s.write('db', '{"v":3}');
  eq(await s.read('db'), '{"v":3}', 'and the next save recovers cleanly');
  const queueAlive = await s.write('db', '{"v":4}').then(() => true, () => false);
  ok(queueAlive, 'a failed write does not jam the queue');
});

await describe('corruption', async () => {
  const fs = fakeFs();
  const s = new FileStorage(fs.mod);
  await s.write('db', '{"v":1}');
  await s.write('db', '{"v":2}');
  fs.files.set('file:///docs/overload/db.json', '{"v":2, trunc');
  eq(await s.read('db'), '{"v":1}', 'a truncated file falls back to the backup');
  await s.remove('db');
  eq(await s.read('db'), null, 'remove clears every copy');
});

report('storage');
