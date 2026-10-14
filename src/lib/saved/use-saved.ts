"use client";
import { useSyncExternalStore } from "react";
import { createSavedStore, EMPTY_SAVED, SAVED_KEY } from "./local-saved";
export const savedJobs = createSavedStore(() => window.localStorage);
const serverSnapshot = () => EMPTY_SAVED;
let subscribers = 0;
function refresh() {
  savedJobs.read();
}
function storageChanged(event: StorageEvent) {
  if (event.key === null || event.key === SAVED_KEY) refresh();
}
function subscribe(listener: () => void) {
  const stop = savedJobs.subscribe(listener);
  if (subscribers++ === 0) {
    window.addEventListener("storage", storageChanged);
    window.addEventListener("job-radar:local-data-changed", refresh);
    refresh();
  }
  return () => {
    stop();
    if (--subscribers === 0) {
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("job-radar:local-data-changed", refresh);
    }
  };
}
export function useSavedJobs() {
  return useSyncExternalStore(subscribe, savedJobs.getSnapshot, serverSnapshot);
}
