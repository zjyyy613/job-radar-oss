export const SAVED_KEY = "job-radar:saved:v1";
export interface SavedEntry {
  job_id: string;
  saved_at: string;
}
export interface SavedSnapshot {
  loaded: boolean;
  entries: SavedEntry[];
  error: string | null;
}
export const EMPTY_SAVED: SavedSnapshot = {
  loaded: false,
  entries: [],
  error: null,
};

export function parseSaved(raw: string | null): SavedEntry[] {
  if (raw === null) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.entries))
    throw Error("Invalid saved data");
  const unique = new Map<string, SavedEntry>();
  for (const entry of value.entries) {
    if (
      !entry ||
      typeof entry.job_id !== "string" ||
      !entry.job_id.trim() ||
      entry.job_id.length > 200 ||
      typeof entry.saved_at !== "string" ||
      !Number.isFinite(Date.parse(entry.saved_at))
    )
      throw Error("Invalid saved entry");
    const previous = unique.get(entry.job_id);
    if (!previous || entry.saved_at > previous.saved_at)
      unique.set(entry.job_id, {
        job_id: entry.job_id,
        saved_at: entry.saved_at,
      });
  }
  return [...unique.values()].sort(
    (a, b) =>
      Date.parse(b.saved_at) - Date.parse(a.saved_at) ||
      a.job_id.localeCompare(b.job_id),
  );
}

export function createSavedStore(
  storage: () => Storage,
  now = () => new Date().toISOString(),
) {
  let snapshot = EMPTY_SAVED;
  const listeners = new Set<() => void>();
  function publish(next: SavedSnapshot) {
    if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read() {
      try {
        publish({
          loaded: true,
          entries: parseSaved(storage().getItem(SAVED_KEY)),
          error: null,
        });
      } catch {
        publish({
          ...snapshot,
          loaded: true,
          error:
            "无法读取本地收藏。请检查浏览器存储权限，或在 Profile 清除本地数据。",
        });
      }
      return snapshot;
    },
    setSaved(id: string, saved: boolean) {
      try {
        if (!id.trim() || id.length > 200) throw Error("Invalid id");
        // Read the latest envelope before each mutation to preserve other tabs' writes.
        const target = storage();
        const entries = parseSaved(target.getItem(SAVED_KEY));
        const next = saved
          ? entries.some((entry) => entry.job_id === id)
            ? entries
            : [...entries, { job_id: id, saved_at: now() }]
          : entries.filter((entry) => entry.job_id !== id);
        const raw = JSON.stringify({ version: 1, entries: next });
        target.setItem(SAVED_KEY, raw);
        publish({ loaded: true, entries: parseSaved(raw), error: null });
        return true;
      } catch {
        publish({
          ...snapshot,
          loaded: true,
          error: "收藏未能保存，操作未确认。请检查浏览器存储空间或权限后重试。",
        });
        return false;
      }
    },
  };
}
