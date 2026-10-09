import { expect, it } from "vitest";
import { queryRadar, type ReadRows, type SourceMeta } from "../../src/lib/data/job-read-model";

function fixture(count: number, options: { duplicate?: boolean; missing?: string; failBatch?: number } = {}) {
  const ids = Array.from({ length: count }, (_, i) => String(i).padStart(4, "0"));
  const jobs = [{ id: "job", source_record_ids: options.duplicate ? [...ids, ...ids] : ids }];
  const batches: string[][] = [];
  let active = 0, peak = 0;
  const read: ReadRows = async <T>(table: string, params: Record<string, string>) => {
    if (table === "jobs") return jobs as T[];
    if (table === "source_runs") return [];
    const batch = params.id.slice(4, -1).split(",");
    batches.push(batch);
    active++; peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    if (batches.length === options.failBatch) throw new Error("source unavailable");
    return batch.filter(id => id !== options.missing).reverse().map(id => ({ id } as SourceMeta)) as T[];
  };
  return { read, jobs, ids, batches, peak: () => peak };
}

it.each([0, 1, 100, 101, 409])("bounds and merges %i source IDs without changing the result contract", async count => {
  const f = fixture(count);
  const result = await queryRadar(f.read);
  expect(f.batches).toHaveLength(Math.ceil(count / 100));
  expect(f.batches.every(b => b.length <= 100)).toBe(true);
  expect(f.peak()).toBeLessThanOrEqual(1);
  expect(result).toEqual({ jobs: [{ ...f.jobs[0], sources: f.ids.map(id => ({ id })) }], sourceHealth: [], warnings: [] });
});

it("deduplicates requested IDs and tolerates missing records and reversed batch results", async () => {
  const f = fixture(101, { duplicate: true, missing: "0003" });
  const result = await queryRadar(f.read);
  expect(f.batches.flat()).toEqual(f.ids);
  expect(result.jobs[0].sources.map(s => s.id)).toEqual(f.ids.filter(id => id !== "0003"));
  expect(result.warnings).toEqual([]);
});

it.each([1, 2, 3])("retains other batches when batch %i fails and continues reading", async failBatch => {
  const f = fixture(201, { failBatch });
  const result = await queryRadar(f.read);
  expect(f.batches).toHaveLength(3);
  expect(result.jobs[0].sources.map(s => s.id)).toEqual(f.ids.filter(id => !f.batches[failBatch - 1].includes(id)));
  expect(result.warnings).toEqual(["来源详情暂不可用，岗位内容仍可浏览。"]);
});
