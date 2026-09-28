import { describe, expect, it } from "vitest";
import { jobProCommand } from "../../scripts/ingest/job-pro-cli";
import { JOB_PRO_SOURCES, JOB_PRO_VERSION } from "../../scripts/ingest/job-pro-sources";

describe("pinned public CLI process boundary", () => {
  it("resolves the installed public bin at exactly 1.2.1, with argv rather than shell interpolation", () => {
    const args = ["tencent", "search", "", "--scope", "campus", "--page-size", "1", "--compact"];
    const invocation = jobProCommand(args);
    expect(JOB_PRO_VERSION).toBe("1.2.1");
    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args[0].replaceAll("\\", "/")).toMatch(/node_modules\/@ha7ch\/job-pro\/dist\/index\.js$/);
    expect(invocation.args.slice(1)).toEqual(args);
    expect(Object.keys(JOB_PRO_SOURCES)).toEqual(["tencent", "xiaomi", "vivo"]);
  });

  it.each([["tencent", "apply"], ["tencent", "all"], ["find", "search"], ["bytedance", "search"]])("refuses unapproved source/verb %s %s", (source, verb) => {
    expect(() => jobProCommand([source, verb])).toThrow();
  });
});
