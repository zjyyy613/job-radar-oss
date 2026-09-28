import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { canonicalize } from "../../src/lib/domain/canonicalize";
import type { CanonicalizationSnapshot } from "../../scripts/ingest/canonicalization-store";
import { extractJob, type ExtractionJob, type ExtractionResult } from "../../scripts/ingest/extract-gates";
import { createGateExtractionStore } from "../../scripts/ingest/gate-extraction-store";
import { record } from "../fixtures/canonical";

const db = new PGlite();
async function snapshot() { return (await db.query<{ value: CanonicalizationSnapshot }>("select public.canonicalization_snapshot() as value")).rows[0].value; }
async function row() { return (await db.query<ExtractionJob>("select * from public.jobs")).rows[0]; }
async function canonicalizeDB() {
  const state = await snapshot();
  await db.query("select public.apply_canonicalization($1,$2::jsonb)", [state.token, JSON.stringify(canonicalize(state.records, state.runs, state.jobs).jobs)]);
}
async function write(job: ExtractionJob, result: ExtractionResult) {
  return db.query("select public.write_gate_extraction($1,$2,$3,$4::jsonb)", [job.id, job.raw_content_hash, job.extraction_attempt_hash, JSON.stringify(result)]);
}
beforeAll(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  for (const name of readdirSync("supabase/migrations").filter(n => n.endsWith(".sql")).sort()) await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  await db.query("insert into public.source_records select * from jsonb_populate_record(null::public.source_records,$1::jsonb)", [JSON.stringify(record("1", { requirements: "本科及以上；每周到岗5天" }))]);
  await canonicalizeDB();
}, 30_000);
afterAll(async () => { await db.close(); });

it("writes validated gates atomically, preserves them through canonicalization, caches unchanged hash", async () => {
  const job = await row();
  const model = vi.fn();
  const result = await extractJob(job, model);
  expect(result.status).toBe("success");
  await db.exec("set role service_role");
  await write(job, result);
  await db.exec("reset role");
  const stored = await row();
  expect(stored.gates).toEqual(result.gates);
  await canonicalizeDB();
  expect(await row()).toEqual(stored);
  expect((await extractJob(await row(), model)).status).toBe("skipped");
  expect(model).not.toHaveBeenCalled();
  await expect(write(job, result)).rejects.toThrow(/Stale/);
});
it("changed JD + invalid extraction preserves previous gates and successful metadata, records failure", async () => {
  const previous = await row();
  await db.exec("update public.source_records set requirements='博士相关方向，或具备长期科研意愿的硕士'");
  await canonicalizeDB();
  const job = await row();
  expect(job.gates).toEqual(previous.gates);
  expect(job.raw_content_hash).not.toBe(previous.raw_content_hash);
  const model = vi.fn().mockResolvedValue({ gates: [null], metadata: [] });
  const result = await extractJob(job, model);
  await write(job, result);
  const stored = await row();
  expect(stored).toMatchObject({ gates: previous.gates, extraction_status: "failed", extraction_error: "extraction_failed" });
  expect(stored).toHaveProperty("extraction_input_hash", previous.raw_content_hash);
  expect(stored).toHaveProperty("extracted_at", (previous as unknown as { extracted_at: string }).extracted_at);
  await extractJob(stored, model);
  expect(model).toHaveBeenCalledTimes(1);
});
it("DB refuses stale content and empty/fabricated quotes", async () => {
  const old = await row();
  await db.exec("update public.source_records set requirements='本科及以上'");
  await canonicalizeDB();
  const job = await row();
  const result = await extractJob(job, vi.fn());
  await expect(write(old, result)).rejects.toThrow(/Stale/);
  const invalid = structuredClone(result);
  invalid.gates[0].evidence = [];
  await expect(write(job, invalid)).rejects.toThrow(/evidence/);
  invalid.gates[0].evidence = [{ quote: "not in JD", source: "requirements", context: null }];
  await expect(write(job, invalid)).rejects.toThrow(/Ungrounded/);
});
it("anon cannot call extraction mutation", async () => {
  const job = await row();
  const result = await extractJob(job, vi.fn());
  await db.exec("set role anon");
  try { await expect(write(job, result)).rejects.toMatchObject({ code: "42501" }); }
  finally { await db.exec("reset role"); }
});
it("REST uses secret apikey without bearer, bounds IDs, and independently validates before writing", async () => {
  const job = await row();
  const result = await extractJob(job, vi.fn());
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
  const store = createGateExtractionStore("https://example.com", "sb_secret_test", fetcher);
  await expect(store.read([])).rejects.toThrow();
  const invalid = structuredClone(result);
  invalid.gates[0].evidence = [];
  await expect(store.write(job, invalid)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await expect(store.write(job, result)).rejects.toThrow(/not confirmed/);
  expect(fetcher.mock.calls[0][1]?.headers).toEqual({ apikey: "sb_secret_test", "Content-Type": "application/json" });
});
