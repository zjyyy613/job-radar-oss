import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SourceRun } from "./contracts";
import { mapJobProRecord, upstreamObject } from "./job-pro-adapter";
import { invokeJobPro } from "./job-pro-cli";
import { ADAPTER_VERSION, JOB_PRO_SOURCES, isJobProSource, sourceIdentity, type JobProScope, type JobProSource } from "./job-pro-sources";
import { createSourceStore, serverConfig, type IngestionStore } from "./source-store";

interface RunOptions { sources: readonly JobProSource[]; scope: JobProScope; limit: number }
interface Dependencies { cli: (args: readonly string[]) => Promise<unknown>; store?: IngestionStore; now?: () => string }
interface SourceResult {
  run: SourceRun;
  records_mapped: number;
  records_written: number;
  mapped_ids: string[];
  audit_written: boolean;
  audit_error: string | null;
}

function validateOptions(options: RunOptions) {
  if (!options.sources.length || options.sources.some((source) => !isJobProSource(source)) || new Set(options.sources).size !== options.sources.length) throw new Error("Invalid source allowlist selection");
  if (!["campus", "intern"].includes(options.scope) || !Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50) throw new Error("Use campus/intern and a limit of 1–50 per company");
}

export async function runIngestion(options: RunOptions, { cli, store, now = () => new Date().toISOString() }: Dependencies) {
  validateOptions(options);
  const sources: SourceResult[] = [];
  for (const source of options.sources) {
    const sourceDeadline = performance.now() + 5 * 60_000;
    const run: SourceRun = {
      id: randomUUID(), ...sourceIdentity(source), full_list: false,
      started_at: now(), finished_at: now(), status: "success",
      records_seen: 0, records_new: 0, records_updated: 0,
      adapter_version: ADAPTER_VERSION, error_type: null, error_message: null,
    };
    const result: SourceResult = { run, records_mapped: 0, records_written: 0, mapped_ids: [], audit_written: false, audit_error: null };
    const errors: string[] = [];
    let stage = "search_failed";
    try {
      const search = upstreamObject(await cli([source, "search", "", "--scope", options.scope, "--page-size", String(options.limit), "--compact"]));
      if (search.ok !== true || search.source !== JOB_PRO_SOURCES[source].upstream || !Array.isArray(search.positions) || !Number.isInteger(search.total) || Number(search.total) < 0) throw new Error("Invalid search response");
      if (Number(search.total) < search.positions.length || (Number(search.total) > 0 && search.positions.length === 0)) throw new Error("Inconsistent search page");
      const positions = search.positions.slice(0, options.limit);
      run.records_seen = positions.length;
      const seen = new Set<string>();
      for (const item of positions) {
        // Each individual process/request is bounded too; leave time for other companies.
        if (performance.now() >= sourceDeadline) { errors.push("source_timeout"); break; }
        stage = "invalid_record";
        try {
          const listed = mapJobProRecord(item, source, now());
          if (seen.has(listed.source_job_id)) throw new Error("Duplicate listing identity");
          seen.add(listed.source_job_id);
          stage = "detail_failed";
          const detail = upstreamObject(await cli([source, "detail", listed.source_job_id, "--compact"]));
          if (detail.ok !== true || detail.source !== JOB_PRO_SOURCES[source].upstream) throw new Error("Invalid detail response");
          stage = "invalid_record";
          const record = mapJobProRecord(detail, source, now());
          if (record.source_job_id !== listed.source_job_id) throw new Error("Detail identity mismatch");
          result.records_mapped++;
          result.mapped_ids.push(record.source_job_id);
          if (store) {
            stage = "write_failed";
            const disposition = await store.upsertRecord(record);
            if (disposition === "new") run.records_new++;
            else run.records_updated++;
            result.records_written++;
          }
        } catch { errors.push(stage); }
      }
    } catch { errors.push(stage); }
    if (errors.length) {
      run.status = (store ? result.records_written : result.records_mapped) > 0 ? "partial" : "failed";
      run.error_type = errors[0];
      run.error_message = `${errors.length} failure(s): ${[...new Set(errors)].join(", ")}`;
    }
    run.finished_at = now();
    if (store) {
      try { await store.writeRun(run); result.audit_written = true; }
      catch { result.audit_error = "source_runs write failed"; }
    }
    sources.push(result);
  }
  const succeeded = sources.filter((source) => source.run.status === "success" && !source.audit_error).length;
  const useful = sources.some((source) => source.run.status !== "failed");
  return { status: succeeded === sources.length ? "success" : useful ? "partial" : "failed", dry_run: !store, sources };
}

export function parseOptions(args: string[]): RunOptions & { dryRun: boolean } {
  const options: RunOptions & { dryRun: boolean } = { sources: Object.keys(JOB_PRO_SOURCES) as JobProSource[], scope: "campus", limit: 20, dryRun: false };
  let mode: string | undefined;
  const used = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (used.has(key)) throw new Error("Duplicate option");
    used.add(key);
    if (key === "--write" || key === "--dry-run") {
      if (mode) throw new Error("Choose exactly one of --write / --dry-run");
      mode = key; options.dryRun = key === "--dry-run";
    } else if (["--sources", "--scope", "--limit"].includes(key)) {
      const value = args[++i];
      if (!value) throw new Error("Missing option value");
      if (key === "--sources") options.sources = value.split(",") as JobProSource[];
      if (key === "--scope") options.scope = value as JobProScope;
      if (key === "--limit") options.limit = Number(value);
    } else throw new Error("Unknown option");
  }
  if (!mode) throw new Error("Choose --dry-run or --write explicitly");
  validateOptions(options);
  return options;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  let store: IngestionStore | undefined;
  if (!options.dryRun) {
    const { url, key } = serverConfig(process.env);
    store = createSourceStore(url, key);
  }
  const result = await runIngestion(options, { cli: invokeJobPro, store });
  console.log(JSON.stringify(result, null, 2));
  // Mixed source failures are isolated; lost audit records still require action.
  if (result.status === "failed" || result.sources.some((source) => source.audit_error)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("job-pro ingestion could not start. Check server-only Supabase configuration and options: --dry-run or --write, --sources tencent,xiaomi,vivo, --scope campus|intern, --limit 1–50.");
    process.exitCode = 1;
  });
}
