import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { JOB_PRO_VERSION, isJobProSource } from "./job-pro-sources";

const exec = promisify(execFile);

export function jobProCommand(args: readonly string[]) {
  if (!isJobProSource(args[0] ?? "") || !["search", "detail"].includes(args[1])) {
    throw new Error("Only allowlisted source search/detail commands are permitted");
  }
  // Public package metadata/bin only; no private adapter API imports.
  const packagePath = createRequire(import.meta.url).resolve("@ha7ch/job-pro/package.json");
  const metadata = JSON.parse(readFileSync(packagePath, "utf8"));
  if (metadata.version !== JOB_PRO_VERSION || typeof metadata.bin?.["job-pro"] !== "string") {
    throw new Error(`Expected @ha7ch/job-pro@${JOB_PRO_VERSION} with a published bin`);
  }
  return { command: process.execPath, args: [resolve(dirname(packagePath), metadata.bin["job-pro"]), ...args] };
}

export async function invokeJobPro(args: readonly string[]): Promise<unknown> {
  const invocation = jobProCommand(args);
  // Never pass database credentials or unrelated application secrets to upstream.
  const env = { NODE_ENV: process.env.NODE_ENV ?? "production", ...Object.fromEntries([
    "PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "HOME", "USERPROFILE",
    "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "NODE_EXTRA_CA_CERTS",
  ].flatMap((key) => process.env[key] ? [[key, process.env[key]!]] : [])) };
  return readWithRetry(async () => {
    const { stdout } = await exec(invocation.command, invocation.args, {
      timeout: 45_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, env,
    });
    return JSON.parse(stdout.trim());
  });
}

export class JobProFailure extends Error {
  constructor(public readonly kind: "rate_limited" | "access_denied" | "network_failed" | "upstream_rejected") { super(kind); }
}
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
/** Serial reads, one retry for transport/5xx only. Never retry access control or rate limits. */
export async function readWithRetry(operation: () => Promise<unknown>, pause = wait): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await pause(attempt ? 1500 : 350);
    try {
      const value = await operation();
      if (value && typeof value === "object" && "ok" in value && value.ok === false) {
        const message = JSON.stringify(value);
        throw new JobProFailure(/429|too many requests/i.test(message) ? "rate_limited"
          : /403|captcha|access denied/i.test(message) ? "access_denied"
          : /network|fetch failed|timeout|HTTP 5\d\d/i.test(message) ? "network_failed" : "upstream_rejected");
      }
      return value;
    } catch (error) {
      // CLI may exit nonzero for access errors; inspect locally, never emit diagnostics.
      const diagnostic = error instanceof Error ? error.message + " " + String((error as Error & { stderr?: string }).stderr ?? "") : "";
      const failure = error instanceof JobProFailure ? error : new JobProFailure(
        /429|too many requests/i.test(diagnostic) ? "rate_limited"
          : /403|captcha|access denied/i.test(diagnostic) ? "access_denied" : "network_failed");
      if (attempt === 1 || failure.kind !== "network_failed") throw failure;
    }
  }
  throw new JobProFailure("network_failed");
}
