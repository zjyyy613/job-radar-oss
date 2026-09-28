import { describe, expect, it, vi } from "vitest";
import { createSourceStore, serverConfig } from "../../scripts/ingest/source-store";
import { mapJobProRecord } from "../../scripts/ingest/job-pro-adapter";
import type { SourceRun } from "../../scripts/ingest/contracts";

const record = mapJobProRecord({ post_id: "123", title: "fixture" }, "tencent", "2026-09-28T00:00:00Z");
const fakeKey = "sb_secret_test_only_not_a_real_key";
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const run: SourceRun = {
  id: "00000000-0000-4000-8000-000000000001", source: record.source,
  source_family: record.source_family, source_tier: record.source_tier,
  started_at: record.fetched_at, finished_at: record.fetched_at,
  full_list: false, status: "failed", records_seen: 0, records_new: 0, records_updated: 0,
  adapter_version: "job-pro-1.2.1/adapter-1", error_type: "search_failed", error_message: "1 failure(s): search_failed",
};

describe("server-only Task 2 Supabase boundary", () => {
  it("prioritizes the new secret key, with legacy service_role fallback", () => {
    expect(serverConfig({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: fakeKey, SUPABASE_SERVICE_ROLE_KEY: "legacy" }).key).toBe(fakeKey);
    expect(serverConfig({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "legacy" }).key).toBe("legacy");
    expect(() => serverConfig({})).toThrow();
  });

  it.each([false, true])("upserts by composite identity; existing=%s", async (exists) => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(exists ? [{ id: "row-id" }] : []))
      .mockResolvedValueOnce(response([{ source: record.source, source_job_id: record.source_job_id }]));
    const store = createSourceStore("https://example.supabase.co", fakeKey, fetcher);
    expect(await store.upsertRecord(record)).toBe(exists ? "updated" : "new");
    const [lookup] = fetcher.mock.calls[0];
    const [write, init] = fetcher.mock.calls[1];
    expect(new URL(String(lookup)).searchParams.get("source_job_id")).toBe("eq.123");
    expect(new URL(String(write)).pathname).toBe("/rest/v1/source_records");
    expect(new URL(String(write)).searchParams.get("on_conflict")).toBe("source,source_job_id");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(record);
    const headers = new Headers(init?.headers);
    expect(headers.get("apikey")).toBe(fakeKey);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("Prefer")).toContain("resolution=merge-duplicates");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("writes one run with a stable UUID for idempotent audit persistence", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([{ id: run.id }]));
    await createSourceStore("https://example.supabase.co", "legacy-jwt-for-test", fetcher).writeRun(run);
    const [url, init] = fetcher.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe("/rest/v1/source_runs");
    expect(new URL(String(url)).searchParams.get("on_conflict")).toBe("id");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer legacy-jwt-for-test");
    expect(JSON.parse(String(init?.body))).toEqual(run);
  });

  it("does not treat a failed read as a new record or leak a server error body", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ error: fakeKey }, 403));
    const store = createSourceStore("https://example.supabase.co", fakeKey, fetcher);
    await expect(store.upsertRecord(record)).rejects.toThrow("Supabase source_records HTTP 403");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects unconfirmed writes and does not retry ambiguous mutations", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response([])).mockResolvedValueOnce(response([]));
    await expect(createSourceStore("https://example.supabase.co", fakeKey, fetcher).upsertRecord(record)).rejects.toThrow("Unconfirmed");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not report an audit as persisted if the response identifies another run", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response([{ id: "other" }]));
    await expect(createSourceStore("https://example.supabase.co", fakeKey, fetcher).writeRun(run)).rejects.toThrow("Unconfirmed");
  });

  it.each(["http://remote.example", "https://name:password@example.com", "https://example.com/other", "https://example.com/?key=anything"])("rejects unsafe/malformed endpoint %s before a request", (url) => {
    const fetcher = vi.fn<typeof fetch>();
    expect(() => createSourceStore(url, fakeKey, fetcher)).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
