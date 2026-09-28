import type { ExtractionJob, ExtractionResult } from "./extract-gates";
import { validateExtraction } from "./gate-extraction-validation";

export function createGateExtractionStore(baseUrl: string, key: string, request: typeof fetch = fetch) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || !["", "/"].includes(base.pathname) || !key) throw new Error("Invalid Supabase configuration");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  async function call(path: string, body?: object): Promise<unknown> {
    let response: Response;
    try {
      response = await request(new URL(path, base), { method: body ? "POST" : "GET", headers,
        body: body ? JSON.stringify(body) : undefined, redirect: "error", signal: AbortSignal.timeout(30_000) });
    } catch { throw new Error("extraction_store_transport_failed"); }
    if (!response.ok) throw new Error(`extraction_store_http_${response.status}`);
    return response.json();
  }
  return {
    async read(ids: string[]): Promise<ExtractionJob[]> {
      if (!ids.length || ids.length > 6 || new Set(ids).size !== ids.length || ids.some(id => !/^[a-f0-9-]{36}$/i.test(id))) throw new Error("Provide 1–6 unique job UUIDs");
      const rows = await call(`/rest/v1/jobs?id=in.(${ids.join(",")})&select=id,title,description,requirements,raw_content_hash,gates,extraction_attempt_hash&order=id`);
      if (!Array.isArray(rows) || rows.length !== ids.length || rows.some(row => !ids.includes(row.id) || !Array.isArray(row.gates))) throw new Error("Incomplete extraction snapshot");
      return rows;
    },
    async write(job: ExtractionJob, result: ExtractionResult) {
      if (result.status === "skipped") throw new Error("Cannot persist skipped extraction");
      if (result.status === "success") validateExtraction(result, job);
      const value = await call("/rest/v1/rpc/write_gate_extraction", { job_id: job.id, expected_hash: job.raw_content_hash,
        expected_attempt_hash: job.extraction_attempt_hash, result }) as Record<string, unknown> | null;
      if (!value || value.id !== job.id || value.status !== result.status || value.attempt_hash !== job.raw_content_hash
          || value.gate_count !== result.gates.length || result.status === "success" && value.input_hash !== job.raw_content_hash) {
        throw new Error("Extraction write not confirmed; inspect DB before retrying");
      }
      return value;
    },
  };
}
