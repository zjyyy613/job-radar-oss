import type { SourceRecord, SourceRun } from "./contracts";

export interface IngestionStore {
  upsertRecord(record: SourceRecord): Promise<"new" | "updated">;
  writeRun(run: SourceRun): Promise<void>;
}

export function serverConfig(env: Record<string, string | undefined>) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server configuration is missing");
  return { url, key };
}

/** Minimal PostgREST boundary. Only the two Task 2 tables can be addressed. */
export function createSourceStore(baseUrl: string, serviceKey: string, request: typeof fetch = fetch): IngestionStore {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) {
    throw new Error("Supabase URL must use HTTPS (HTTP is only allowed for localhost)");
  }
  if (!serviceKey || base.username || base.password || base.search || base.hash || !["", "/"].includes(base.pathname)) {
    throw new Error("Invalid Supabase server configuration");
  }
  // sb_secret_* is an API key, NOT a JWT. Only legacy JWTs use Bearer auth.
  const headers: Record<string, string> = { apikey: serviceKey, "Content-Type": "application/json" };
  if (!serviceKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serviceKey}`;

  async function call(table: "source_records" | "source_runs", query: Record<string, string>, init?: RequestInit) {
    const url = new URL(`/rest/v1/${table}`, base);
    url.search = new URLSearchParams(query).toString();
    const response = await request(url, {
      ...init, redirect: "error", signal: AbortSignal.timeout(20_000),
      headers: { ...headers, ...init?.headers },
    });
    // Error bodies may echo payloads; never include them in diagnostics.
    if (!response.ok) throw new Error(`Supabase ${table} HTTP ${response.status}`);
    return response;
  }

  return {
    async upsertRecord(record) {
      const identity = { source: `eq.${record.source}`, source_job_id: `eq.${record.source_job_id}`, select: "id", limit: "1" };
      const existing: unknown = await (await call("source_records", identity)).json();
      if (!Array.isArray(existing) || existing.some((row) => !row || typeof row.id !== "string")) throw new Error("Invalid source_records lookup response");
      const response = await call("source_records", { on_conflict: "source,source_job_id", select: "source,source_job_id" }, {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(record),
      });
      const written: unknown = await response.json();
      if (!Array.isArray(written) || written.length !== 1 || written[0]?.source !== record.source || written[0]?.source_job_id !== record.source_job_id) {
        throw new Error("Unconfirmed source_records write");
      }
      return existing.length ? "updated" : "new";
    },
    async writeRun(run) {
      const response = await call("source_runs", { on_conflict: "id", select: "id" }, {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(run),
      });
      const written: unknown = await response.json();
      if (!Array.isArray(written) || written.length !== 1 || written[0]?.id !== run.id) throw new Error("Unconfirmed source_runs write");
    },
  };
}
