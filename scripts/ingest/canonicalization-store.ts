import type { CanonicalJob } from "../../src/lib/domain/canonical-job";
import type { PersistedSourceRecord } from "./contracts";
import type { ReliabilityRun } from "../../src/lib/domain/source-reliability";
import type { CanonicalizedJob } from "../../src/lib/domain/canonicalize";

export interface CanonicalizationSnapshot {
  token: string; records: PersistedSourceRecord[]; runs: ReliabilityRun[]; jobs: CanonicalJob[];
}
export function createCanonicalizationStore(baseUrl: string, key: string, request: typeof fetch = fetch) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || !["", "/"].includes(base.pathname) || !key) throw new Error("Invalid Supabase configuration");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  async function rpc(name: "canonicalization_snapshot" | "apply_canonicalization", body: object) {
    const response = await request(new URL(`/rest/v1/rpc/${name}`, base), {
      method: "POST", headers, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Canonicalization RPC HTTP ${response.status}`);
    return response.json();
  }
  return {
    async snapshot(): Promise<CanonicalizationSnapshot> {
      const value = await rpc("canonicalization_snapshot", {});
      if (!value || !/^[a-f0-9]{32}$/.test(value.token) || !Array.isArray(value.records) || !Array.isArray(value.runs) || !Array.isArray(value.jobs)) throw new Error("Invalid canonicalization snapshot");
      return value;
    },
    async apply(token: string, jobs: CanonicalizedJob[]) {
      const result: unknown = await rpc("apply_canonicalization", { expected_token: token, planned_jobs: jobs });
      const expected = jobs.map(j => ({ id: j.id, source_record_ids: j.source_record_ids, raw_content_hash: j.raw_content_hash,
        application_status: j.application_status, consecutive_missing_count: j.consecutive_missing_count }));
      if (!Array.isArray(result) || result.length !== expected.length || expected.some(job => {
        const row = result.find(item => item?.id === job.id);
        return !row || Object.entries(job).some(([key, value]) => JSON.stringify(row[key]) !== JSON.stringify(value));
      })) throw new Error("Canonicalization write not confirmed; inspect DB before retrying");
      return result.length;
    },
  };
}
