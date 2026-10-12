// An in-memory stand-in for the parts of `chrome.storage` the repository uses.
// Writes are async (like Chrome) and fire `onChanged` listeners for the area.
type ChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string
) => void;

type StorageStub = {
  data: Map<string, unknown>;
  area: chrome.storage.StorageArea;
  emit: (keys: string[], areaName?: string) => void;
  chrome: { storage: { onChanged: typeof chrome.storage.onChanged } };
};

const tick = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const createStorageStub = (): StorageStub => {
  const data = new Map<string, unknown>();
  const listeners = new Set<ChangeListener>();

  const emit = (keys: string[], areaName = "local"): void => {
    const changes = Object.fromEntries(
      keys.map((key) => [key, { newValue: data.get(key) }])
    );
    for (const listener of listeners) {
      listener(changes, areaName);
    }
  };

  const get = async (keys: string | null): Promise<Record<string, unknown>> => {
    await tick();
    if (keys === null) {
      return Object.fromEntries(data);
    }
    return data.has(keys) ? { [keys]: data.get(keys) } : {};
  };

  const set = async (items: Record<string, unknown>): Promise<void> => {
    await tick();
    for (const [key, value] of Object.entries(items)) {
      // Like Chrome, store a JSON-shaped copy, never the caller's object.
      data.set(key, structuredClone(value));
    }
    emit(Object.keys(items));
  };

  const remove = async (key: string): Promise<void> => {
    await tick();
    data.delete(key);
    emit([key]);
  };

  const onChanged = {
    addListener: (listener: ChangeListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: ChangeListener) => {
      listeners.delete(listener);
    },
  };

  return {
    data,
    // Only the members the repository calls are implemented.
    area: { get, set, remove } as unknown as chrome.storage.StorageArea,
    emit,
    chrome: {
      storage: {
        onChanged: onChanged as unknown as typeof chrome.storage.onChanged,
      },
    },
  };
};

export { createStorageStub };
