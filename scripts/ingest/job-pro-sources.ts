export const JOB_PRO_VERSION = "1.2.1";
export const ADAPTER_VERSION = "job-pro-1.2.1/adapter-1";

// Only verified official company endpoints. Expansion requires new fixtures/smoke.
export const JOB_PRO_SOURCES = {
  tencent: { company: "腾讯", upstream: "join.qq.com" },
  xiaomi: { company: "小米", upstream: "xiaomi.jobs.f.mioffice.cn" },
  vivo: { company: "vivo", upstream: "hr-campus.vivo.com" },
} as const;
export type JobProSource = keyof typeof JOB_PRO_SOURCES;
export type JobProScope = "campus" | "intern";

export function isJobProSource(value: string): value is JobProSource {
  return Object.hasOwn(JOB_PRO_SOURCES, value);
}

export const sourceIdentity = (source: JobProSource) => ({
  source: `job-pro:${source}`,
  source_family: "company_ats",
  source_tier: "authoritative" as const,
});
