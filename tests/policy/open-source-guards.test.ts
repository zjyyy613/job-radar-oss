import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Open-source release guards.
 *
 * The private upstream repository and this public candidate are kept in sync by
 * cherry-picking. These checks fail fast if a future sync (or an accidental
 * `git add -A`) would reintroduce something that must never ship publicly:
 *
 *  1. third-party skill packs whose redistribution terms are unproven,
 *  2. an executable production refresh workflow (writes to a live database),
 *  3. an executable production collection workflow (same, via the NCSS path),
 *  4. environment files or credential-bearing configuration.
 *
 * They run locally (`npm test`) and in CI (`ci.yml`), and need no credentials.
 */

const WORKFLOWS = ".github/workflows";
const ARCHIVED = "docs/production/workflows";

const workflowFiles = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml")) : [];
const read = (path: string) => readFileSync(path, "utf8");

/** Workflows allowed to exist in the executable directory, with the reason. */
const EXECUTABLE = {
  "ci.yml": "offline checks only: no secrets, no database, no external writes",
  "candidate-audit.yml": "manual, read-only audit: no secrets, no database, no model calls",
} as const;

/** Files that may reference repository secrets, and only outside the executable dir. */
const SECRET_REFERENCE_ALLOWED = new Set([`${ARCHIVED}/refresh.yml`, `${ARCHIVED}/ingest-ncss.yml`]);

describe("open-source guards: third-party skills", () => {
  it("only bundles the two skill packs whose licenses are proven", () => {
    const skills = readdirSync(".agents/skills").filter((name) => !name.startsWith("."));
    expect(skills.sort()).toEqual(["anti-ui-slop", "hallmark"]);
    // Each retained pack keeps its own license evidence.
    for (const skill of skills) {
      const dir = `.agents/skills/${skill}`;
      const files = readdirSync(dir);
      expect(files).toContain("UPSTREAM.md");
      expect(files).toContain("LICENSE");
    }
  });

  it("does not resurrect the excluded packs anywhere in the tree", () => {
    const excluded = ["visual-quality-final-audit", "web-design-guidelines"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (excluded.includes(entry.name)) offenders.push(path);
          else walk(path);
        }
      }
    };
    walk(".");
    expect(offenders).toEqual([]);
  });
});

describe("open-source guards: no executable production automation", () => {
  it("exposes only the allowlisted workflows", () => {
    expect(workflowFiles(WORKFLOWS).sort()).toEqual(Object.keys(EXECUTABLE).sort());
  });

  it("never schedules anything, so nothing can write without a human", () => {
    for (const file of workflowFiles(WORKFLOWS)) {
      const text = read(`${WORKFLOWS}/${file}`);
      expect(text, `${file} must not define a schedule`).not.toMatch(/^\s*schedule:/m);
      expect(text, `${file} must not define a cron`).not.toContain("cron:");
    }
  });

  it("keeps production collection and refresh workflows out of the executable directory", () => {
    expect(existsSync(`${WORKFLOWS}/refresh.yml`)).toBe(false);
    expect(existsSync(`${WORKFLOWS}/ingest-ncss.yml`)).toBe(false);
    // They are kept as inert references instead.
    expect(existsSync(`${ARCHIVED}/refresh.yml`)).toBe(true);
    expect(existsSync(`${ARCHIVED}/ingest-ncss.yml`)).toBe(true);
    // And the archived copies carry no automatic trigger either.
    for (const file of workflowFiles(ARCHIVED)) {
      const text = read(`${ARCHIVED}/${file}`);
      expect(text, `${file} must not define a schedule`).not.toMatch(/^\s*schedule:/m);
      expect(text, `${file} must not define a cron`).not.toContain("cron:");
    }
  });

  it("allows credentials only in the archived production references", () => {
    const offenders = workflowFiles(WORKFLOWS)
      .filter((file) => /secrets\./.test(read(`${WORKFLOWS}/${file}`)));
    expect(offenders).toEqual([]);
    // The archived pipeline may reference secret names (never values); assert that.
    for (const path of SECRET_REFERENCE_ALLOWED) {
      const text = read(path);
      expect(text).toMatch(/\$\{\{\s*secrets\.[A-Z_]+\s*\}\}/);
      expect(text, `${path} must not inline a secret value`).not.toMatch(/secrets\.[A-Z_]+\s*=\s*\S+/);
    }
  });
});

describe("open-source guards: environment files", () => {
  it("ships only the placeholder env file", () => {
    expect(existsSync(".env.example")).toBe(true);
    for (const forbidden of [".env", ".env.local", ".env.production", ".env.development"]) {
      expect(existsSync(forbidden), `${forbidden} must not exist in the working tree`).toBe(false);
    }
    const example = read(".env.example");
    // Every secret-ish key must be empty; URLs/endpoints may have non-secret values.
    for (const line of example.split(/\r?\n/)) {
      const match = line.match(/^(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DEEPSEEK_API_KEY)\s*=\s*(.*)$/);
      if (match) expect(match[2].trim(), `${match[1]} must be empty`).toBe("");
    }
    expect(example).not.toMatch(/sb_secret_[A-Za-z0-9]/);
    expect(example).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
  });
});
