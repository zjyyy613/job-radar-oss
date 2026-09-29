"use client";

import { useSyncExternalStore } from "react";
import type { Gate } from "../domain/gate";
import type { ApplicationStatus } from "../domain/canonical-job";
import { evaluateQualification, type ExtractionReadiness } from "../domain/qualification-engine";
import { createLocalProfileStore, EMPTY_SNAPSHOT, emptyGuestProfile, LOCAL_PREFIX } from "./local-profile";

// Lazy storage access: neither SSR nor module import reads window/localStorage.
export const localProfile = createLocalProfileStore(() => window.localStorage);
const getServerSnapshot = () => EMPTY_SNAPSHOT;
function subscribe(listener: () => void) {
  const stop = localProfile.subscribe(listener);
  const refresh = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && (event.key === null || event.key.startsWith(LOCAL_PREFIX))) localProfile.read();
  };
  window.addEventListener("storage", refresh);
  localProfile.read();
  return () => { stop(); window.removeEventListener("storage", refresh); };
}
export function useLocalProfile() { return useSyncExternalStore(subscribe, localProfile.getSnapshot, getServerSnapshot); }
/** Future job consumers reuse this hook; Task 6 does not fetch jobs or build Radar. */
export function useQualification(job: { gates: Gate[]; application_status: ApplicationStatus } & Partial<ExtractionReadiness>) {
  const snapshot = useLocalProfile();
  if (!snapshot.loaded) return null;
  return evaluateQualification(snapshot.data?.qualification ?? emptyGuestProfile().qualification, job.gates, job.application_status, job);
}
