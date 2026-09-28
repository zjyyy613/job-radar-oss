import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { canonicalize } from "../../src/lib/domain/canonicalize";
import { createCanonicalizationStore, type CanonicalizationSnapshot } from "../../scripts/ingest/canonicalization-store";
import { runCanonicalization } from "../../scripts/ingest/canonicalize";
import { record } from "../fixtures/canonical";

describe("canonicalization PostgreSQL boundary", () => {
  const db = new PGlite();
  async function snapshot() {
    return (await db.query<{ value: CanonicalizationSnapshot }>("select public.canonicalization_snapshot() as value")).rows[0].value;
  }
  async function apply(state: CanonicalizationSnapshot, jobs = canonicalize(state.records, state.runs, state.jobs).jobs) {
    return db.query("select public.apply_canonicalization($1, $2::jsonb)", [state.token, JSON.stringify(jobs)]);
  }
  beforeAll(async () => {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(readFileSync("supabase/migrations/0001_job_radar_m0.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20260928122238_canonicalization_reliability.sql", "utf8"));
    await db.query("insert into public.source_records select * from jsonb_populate_record(null::public.source_records,$1::jsonb)", [JSON.stringify(record())]);
  }, 30_000);
  afterAll(async () => { await db.close(); });

  it("writes jobs + trace atomically with empty gates; rerun preserves ID and counts", async () => {
    const before = await snapshot();
    await db.exec("set role service_role");
    await apply(before);
    await db.exec("reset role");
    const first = await snapshot();
    expect(first.jobs).toHaveLength(1);
    expect(first.jobs[0]).toMatchObject({ gates: [], consecutive_missing_count: 0, extraction_version: null });
    expect(first.jobs[0]).toHaveProperty("canonicalization_trace.version", "deterministic-v1");
    await apply(first);
    const next = await snapshot();
    expect(next).toEqual(first);
    expect(next.records).toEqual(before.records);
    expect(next.runs).toEqual(before.runs);
  });
  it("rejects stale reads without changing jobs", async () => {
    const old = await snapshot();
    await db.exec("update public.source_records set description='Updated JD'");
    await expect(apply(old)).rejects.toThrow(/Stale/);
    expect((await snapshot()).jobs).toEqual(old.jobs);
  });
  it("rejects incomplete or duplicated linkage without deleting jobs", async () => {
    const state = await snapshot();
    await expect(apply(state, [])).rejects.toThrow(/every source/);
    const jobs = canonicalize(state.records).jobs;
    jobs[0].source_record_ids.push(jobs[0].source_record_ids[0]);
    await expect(apply(state, jobs)).rejects.toThrow(/every source/);
    expect((await snapshot()).jobs).toEqual(state.jobs);
  });
  it("protects future extraction data instead of clearing it", async () => {
    await db.exec("update public.jobs set extraction_version='future-task-5'");
    const state = await snapshot();
    await expect(apply(state)).rejects.toThrow(/extraction metadata/);
    expect((await snapshot()).jobs).toEqual(state.jobs);
    await db.exec("update public.jobs set extraction_version=null");
  });
  it("anon can read jobs but cannot read snapshots or mutate canonical state", async () => {
    await db.exec("set role anon");
    try {
      expect((await db.query("select id from public.jobs")).rows).toHaveLength(1);
      await expect(snapshot()).rejects.toMatchObject({ code: "42501" });
      await expect(db.query("select public.apply_canonicalization('token','[]')")).rejects.toMatchObject({ code: "42501" });
    } finally { await db.exec("reset role"); }
  });
});

describe("canonicalization REST runner", () => {
  it("dry run does not write; write uses the snapshot token", async () => {
    const state: CanonicalizationSnapshot = { token: "a".repeat(32), records: [record()], runs: [], jobs: [] };
    const store = { snapshot: vi.fn(async () => state), apply: vi.fn(async () => 1) };
    await runCanonicalization(store, false);
    expect(store.apply).not.toHaveBeenCalled();
    expect(await runCanonicalization(store, true)).toMatchObject({ source_records: 1, jobs_written: 1 });
    expect(store.apply).toHaveBeenCalledWith(state.token, expect.any(Array));
  });
  it("uses secret apikey only and rejects unconfirmed writes", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]"));
    const store = createCanonicalizationStore("https://example.com", "sb_secret_test", fetcher);
    await expect(store.apply("token", canonicalize([record()]).jobs)).rejects.toThrow(/not confirmed/);
    const headers = fetcher.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.apikey).toBe("sb_secret_test");
    expect(headers.Authorization).toBeUndefined();
    expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never echoes response bodies or accepts a malformed snapshot", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("private payload", { status: 500 }));
    const store = createCanonicalizationStore("https://example.com", "legacy", fetcher);
    await expect(store.snapshot()).rejects.toThrow("Canonicalization RPC HTTP 500");
    fetcher.mockResolvedValue(new Response("{}"));
    await expect(store.snapshot()).rejects.toThrow(/Invalid/);
  });
});
