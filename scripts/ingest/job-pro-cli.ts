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
  const { stdout } = await exec(invocation.command, invocation.args, {
    timeout: 45_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, env,
  });
  return JSON.parse(stdout.trim());
}
