import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateGate, type Gate } from "../../src/lib/domain/gate";
import type { CanonicalJob } from "../../src/lib/domain/canonical-job";
import type { PersistedSourceRecord, SourceRecord } from "../../src/lib/domain/source-record";
import type { SourceRun } from "../../scripts/ingest/contracts";

const source: SourceRecord = {
  source: "fixture-company", source_family: "company_ats", source_tier: "authoritative",
  source_job_id: "intern-1", source_url: null,
  company: "测试企业", title: "实习生", location: [], internship_type: null,
  recruitment_batch: null, salary: null, industry: null, company_nature: null,
  company_size: null, welfare: [], published_at: null, deadline: null,
  description: null, requirements: null, apply_url: null,
  fetched_at: "2026-09-27T00:00:00Z", last_seen_at: "2026-09-27T00:00:00Z",
  raw_hash: "fixture-hash", raw_payload: { original: { untouched: [1, null, "原文"] } },
};
const gate: Gate = validateGate({
  id: "education-1", field: "education", requirement: "required", scope: "job",
  value: { kind: "education_minimum", value: "bachelor" },
  evidence: [{ quote: "本科及以上", source: "requirements", context: null }], note: null,
});

describe("M0 migration in PostgreSQL (PGlite)", () => {
  const db = new PGlite();
  let sourceId: string;

  beforeAll(async () => {
    // Supabase supplies these database roles; no Auth service is used in this test.
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(readFileSync("supabase/migrations/0001_job_radar_m0.sql", "utf8"));
    const inserted = await db.query<PersistedSourceRecord>(`
      insert into source_records (
        source, source_family, source_tier, source_job_id, company, title,
        fetched_at, last_seen_at, raw_hash, raw_payload
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *
    `, [source.source, source.source_family, source.source_tier, source.source_job_id,
      source.company, source.title, source.fetched_at, source.last_seen_at, source.raw_hash,
      JSON.stringify(source.raw_payload)]);
    sourceId = inserted.rows[0].id;
  }, 30_000);

  afterAll(async () => { await db.close(); });

  it("round-trips provenance/raw JSON and represents missing source fields without invention", async () => {
    const result = await db.query<PersistedSourceRecord>("select * from source_records where id = $1", [sourceId]);
    const row = result.rows[0];
    expect(Object.keys(row).sort()).toEqual([...Object.keys(source), "id"].sort());
    expect(row).toMatchObject({
      source: source.source, source_family: source.source_family, source_tier: "authoritative",
      raw_payload: source.raw_payload, raw_hash: source.raw_hash,
      salary: null, deadline: null, description: null, location: [], welfare: [],
    });
  });

  it("enforces source identity per source while allowing the same upstream ID in another source", async () => {
    const sql = `insert into source_records
      (source, source_family, source_tier, source_job_id, company, title, fetched_at, last_seen_at, raw_hash, raw_payload)
      values ($1, 'company_ats', 'authoritative', 'intern-1', '公司', '岗位', now(), now(), 'hash', '{}')`;
    await expect(db.query(sql, [source.source])).rejects.toMatchObject({ code: "23505" });
    await expect(db.query(sql, ["another-source"])).resolves.toMatchObject({ affectedRows: 1 });
  });

  it("persists canonical linkage, gates, extraction metadata and conservative defaults", async () => {
    const result = await db.query<CanonicalJob>(`
      insert into jobs (company, title, source_record_ids, gates, raw_content_hash, extraction_version, extracted_at, extractor_type)
      values ('测试企业', '实习生', $1, $2, 'content-hash', 'v1', now(), 'deterministic') returning *
    `, [[sourceId], JSON.stringify([gate])]);
    expect(result.rows[0]).toMatchObject({
      application_status: "unknown", consecutive_missing_count: 0,
      source_record_ids: [sourceId], gates: [gate], raw_content_hash: "content-hash",
      extraction_version: "v1", extractor_type: "deterministic",
    });
    expect(result.rows[0].extracted_at).not.toBeNull();
    expect(validateGate(result.rows[0].gates[0])).toEqual(gate);
  });

  it.each(["success", "partial", "failed"] as const)("stores a %s source run without changing job state", async (status) => {
    const result = await db.query<SourceRun>(`
      insert into source_runs (source, source_family, source_tier, started_at, finished_at, status, adapter_version, error_type, error_message)
      values ('fixture-company', 'company_ats', 'authoritative', now(), now(), $1, 'v1', $2, $3) returning *
    `, [status, status === "failed" ? "timeout" : null, status === "failed" ? "Timed out" : null]);
    expect(result.rows[0]).toMatchObject({ status, full_list: false, records_seen: 0, records_new: 0, records_updated: 0 });
    const jobs = await db.query("select application_status, consecutive_missing_count from jobs");
    expect(jobs.rows).toEqual([{ application_status: "unknown", consecutive_missing_count: 0 }]);
  });

  it.each([
    "insert into jobs (company, title, application_status) values ('公司', '岗位', 'failed')",
    "insert into jobs (company, title, consecutive_missing_count) values ('公司', '岗位', -1)",
    "insert into jobs (company, title, gates) values ('公司', '岗位', '{}')",
    "update source_records set source_tier = 'unverified'",
    "update source_runs set status = 'closed'",
    "update source_runs set records_seen = -1",
    "update source_runs set finished_at = started_at - interval '1 second'",
  ])("rejects invalid persisted state %#", async (sql) => {
    await expect(db.exec(sql)).rejects.toMatchObject({ code: "23514" });
  });

  it("enables RLS on all three tables", async () => {
    const result = await db.query("select relname, relrowsecurity from pg_class where relname in ('jobs', 'source_records', 'source_runs') order by relname");
    expect(result.rows).toEqual([
      { relname: "jobs", relrowsecurity: true },
      { relname: "source_records", relrowsecurity: true },
      { relname: "source_runs", relrowsecurity: true },
    ]);
  });

  it("lets a guest read canonical jobs but not write or read raw payloads/logs", async () => {
    await db.exec("set role anon");
    try {
      const jobs = await db.query("select * from jobs");
      expect(jobs.rows).toHaveLength(1);
      for (const sql of [
        "select * from source_records", "select * from source_runs",
        "insert into jobs (company, title) values ('bad', 'bad')",
        "update jobs set application_status = 'closed'", "delete from jobs",
      ]) {
        await expect(db.exec(sql)).rejects.toMatchObject({ code: "42501" });
      }
    } finally { await db.exec("reset role"); }
  });

  it("allows server-side ingestion writes through the existing service role", async () => {
    await db.exec("set role service_role");
    try {
      await expect(db.query("update source_records set raw_hash = 'server-write' where id = $1", [sourceId])).resolves.toMatchObject({ affectedRows: 1 });
      const result = await db.query("select raw_hash from source_records where id = $1", [sourceId]);
      expect(result.rows).toEqual([{ raw_hash: "server-write" }]);
    } finally { await db.exec("reset role"); }
  });
});
