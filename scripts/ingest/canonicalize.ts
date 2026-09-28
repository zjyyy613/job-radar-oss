import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalize } from "../../src/lib/domain/canonicalize";
import { createCanonicalizationStore } from "./canonicalization-store";
import { serverConfig } from "./source-store";

export async function runCanonicalization(store: ReturnType<typeof createCanonicalizationStore>, write: boolean) {
  const snapshot = await store.snapshot();
  // The Task 5 migration preserves existing extraction columns on conflict.
  // Changed JD hashes are re-extracted separately; old valid gates survive failures.
  if (snapshot.jobs.some(j => j.source_record_ids.some(id => !snapshot.records.some(r => r.id === id)))) throw new Error("Orphaned canonical source linkage requires review");
  const plan = canonicalize(snapshot.records, snapshot.runs, snapshot.jobs);
  const written = write ? await store.apply(snapshot.token, plan.jobs) : 0;
  return { dry_run: !write, source_records: snapshot.records.length, jobs_before: snapshot.jobs.length,
    jobs_after: plan.jobs.length, jobs_written: written,
    merged_groups: plan.jobs.filter(j => j.source_record_ids.length > 1).length,
    decisions: plan.decisions,
    jobs: plan.jobs.map(j => ({ id: j.id, company: j.company, title: j.title, source_record_ids: j.source_record_ids,
      application_status: j.application_status, consecutive_missing_count: j.consecutive_missing_count })) };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--dry-run", "--write"].includes(args[0])) throw new Error("Choose --dry-run or --write");
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { url, key } = serverConfig(process.env);
  console.log(JSON.stringify(await runCanonicalization(createCanonicalizationStore(url, key), args[0] === "--write"), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Bound the whole CLI, including transport shutdown. A timeout is not proof
  // that a write failed: inspect persisted jobs before retrying.
  const deadline = setTimeout(() => {
    console.error("Canonicalization exceeded its 60-second budget. Inspect DB before retrying any write.");
    process.exit(1);
  }, 60_000);
  await main().catch(() => {
    console.error("Canonicalization failed. Check server configuration, migration, input evidence and snapshot freshness. Inspect DB before retrying any unconfirmed write.");
    process.exitCode = 1;
  }).finally(() => clearTimeout(deadline));
}
