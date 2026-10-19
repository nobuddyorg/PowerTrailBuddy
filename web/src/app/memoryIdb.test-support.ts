// An in-memory idb-keyval for tests of the app above data/: `vi.mock('idb-keyval', () => import('./memoryIdb.test-support'))`.

/** Every store's values by key, and switches that make reads or writes fail as a broken or full disk would. */
export const memoryIdb = {
  values: new Map<string, unknown>(),
  refuseReads: false,
  refuseWrites: false,
  reset() {
    this.values.clear();
    this.refuseReads = false;
    this.refuseWrites = false;
  },
};

const key = (store: unknown, name: string) => `${String(store)}:${name}`;

function write(work: () => void): Promise<void> {
  if (memoryIdb.refuseWrites) {
    return Promise.reject(new DOMException('full', 'QuotaExceededError'));
  }
  work();
  return Promise.resolve();
}

export function createStore(database: string, store: string): string {
  return `${database}/${store}`;
}

export function get(name: string, store: unknown): Promise<unknown> {
  if (memoryIdb.refuseReads) {
    return Promise.reject(new DOMException('broken', 'UnknownError'));
  }
  return Promise.resolve(
    structuredClone(memoryIdb.values.get(key(store, name))),
  );
}

export function set(name: string, value: unknown, store: unknown) {
  return write(() =>
    memoryIdb.values.set(key(store, name), structuredClone(value)),
  );
}

export function update(
  name: string,
  updater: (stored: unknown) => unknown,
  store: unknown,
) {
  return write(() =>
    memoryIdb.values.set(
      key(store, name),
      structuredClone(updater(memoryIdb.values.get(key(store, name)))),
    ),
  );
}

export function del(name: string, store: unknown) {
  return write(() => memoryIdb.values.delete(key(store, name)));
}

export function delMany(names: string[], store: unknown) {
  return write(() => {
    for (const name of names) memoryIdb.values.delete(key(store, name));
  });
}

/** What the app stored under `name`, as it would read it back. */
export function storedValue(name: string): unknown {
  return memoryIdb.values.get(key('powertrailbuddy/state', name));
}

/** Puts a value in place before the app loads, as an earlier session would have left it. */
export function storeValue(name: string, value: unknown): void {
  memoryIdb.values.set(key('powertrailbuddy/state', name), value);
}
