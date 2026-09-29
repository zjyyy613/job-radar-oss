import { EDUCATION_LEVELS, STUDENT_STATUSES, type PreferenceProfile, type QualificationProfile } from "../domain/profile";
import { normalizeMajor, normalizeResearch } from "../domain/profile-values";

export const LOCAL_PREFIX = "job-radar:";
export const PROFILE_KEY = `${LOCAL_PREFIX}guest-profile:v1`;
export interface GuestProfile { version: 1; qualification: QualificationProfile; preferences: PreferenceProfile }
export interface ProfileSnapshot { loaded: boolean; data: GuestProfile | null; error: string | null }
export const EMPTY_SNAPSHOT: ProfileSnapshot = { loaded: false, data: null, error: null };
export function emptyGuestProfile(): GuestProfile {
  return { version: 1, qualification: { student_status: null, graduation_year: null, education: null, major: null,
    days_per_week: null, duration_months: null, research_areas: null }, preferences: { preferred_cities: [], preferred_roles: [], preferred_companies: [] } };
}
function assert(ok: unknown): asserts ok { if (!ok) throw new Error("Invalid local profile"); }
function object(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value));
  const row = value as Record<string, unknown>;
  assert(required.every(k => Object.hasOwn(row, k)) && Object.keys(row).every(k => [...required, ...optional].includes(k)));
  return row;
}
function strings(value: unknown): string[] {
  assert(Array.isArray(value) && value.length <= 100 && value.every(v => typeof v === "string" && v.trim() && v.length <= 200));
  return [...new Set((value as string[]).map(v => v.trim()))];
}
export function validateGuestProfile(value: unknown): GuestProfile {
  const envelope = object(value, ["version", "qualification", "preferences"]);
  assert(envelope.version === 1);
  const q = object(envelope.qualification, ["student_status", "graduation_year", "education", "major"], ["days_per_week", "duration_months", "research_areas"]);
  const p = object(envelope.preferences, ["preferred_cities", "preferred_roles", "preferred_companies"]);
  assert(q.student_status === null || STUDENT_STATUSES.includes(q.student_status as "enrolled"));
  assert(q.education === null || EDUCATION_LEVELS.includes(q.education as "bachelor"));
  assert(q.graduation_year === null || typeof q.graduation_year === "number" && Number.isInteger(q.graduation_year) && q.graduation_year >= 1000 && q.graduation_year <= 9999);
  assert(q.major === null || typeof q.major === "string" && q.major.trim() && q.major.length <= 200);
  for (const key of ["days_per_week", "duration_months"] as const) assert(q[key] == null || typeof q[key] === "number" && Number.isFinite(q[key]) && q[key] >= 0);
  assert(q.days_per_week == null || Number.isInteger(q.days_per_week) && Number(q.days_per_week) <= 7);
  const qualification: QualificationProfile = {
    student_status: q.student_status as QualificationProfile["student_status"], graduation_year: q.graduation_year as number | null,
    education: q.education as QualificationProfile["education"], major: q.major === null ? null : normalizeMajor(String(q.major)),
    days_per_week: q.days_per_week as number | null | undefined ?? null,
    duration_months: q.duration_months as number | null | undefined ?? null,
    research_areas: q.research_areas == null ? null : strings(q.research_areas).map(normalizeResearch),
  };
  return { version: 1, qualification, preferences: { preferred_cities: strings(p.preferred_cities), preferred_roles: strings(p.preferred_roles), preferred_companies: strings(p.preferred_companies) } };
}

/** One atomic localStorage envelope; qualification and preferences remain separate objects. */
export function createLocalProfileStore(storage: () => Storage) {
  let snapshot = EMPTY_SNAPSHOT;
  const listeners = new Set<() => void>();
  function publish(next: ProfileSnapshot) {
    if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  }
  function read() {
    try {
      const raw = storage().getItem(PROFILE_KEY);
      publish({ loaded: true, data: raw === null ? null : validateGuestProfile(JSON.parse(raw)), error: null });
    } catch { publish({ loaded: true, data: null, error: "无法读取本地资料。请检查浏览器存储权限，或清除本地 Job Radar 数据后重新填写。" }); }
    return snapshot;
  }
  return {
    read,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    write(value: GuestProfile): boolean {
      try {
        const data = validateGuestProfile(value);
        storage().setItem(PROFILE_KEY, JSON.stringify(data));
        publish({ loaded: true, data, error: null });
        return true;
      } catch { publish({ ...snapshot, loaded: true, error: "未能保存。请检查填写内容和浏览器本地存储权限，再重试。" }); return false; }
    },
    clear(): boolean {
      try {
        const target = storage(), keys: string[] = [];
        for (let index = 0; index < target.length; index++) { const key = target.key(index); if (key?.startsWith(LOCAL_PREFIX)) keys.push(key); }
        keys.forEach(key => target.removeItem(key));
        publish({ loaded: true, data: null, error: null });
        return true;
      } catch { publish({ ...snapshot, error: "未能清除本地数据。请检查浏览器存储权限后重试。" }); return false; }
    },
  };
}
