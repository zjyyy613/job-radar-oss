export const JOB_PRO_VERSION = "1.2.1";
// adapter-3 adds xpeng (Feishu Hire); existing sources map exactly as in adapter-2.
export const ADAPTER_VERSION = "job-pro-1.2.1/adapter-3";

// Only verified official company endpoints. Expansion requires new fixtures/smoke.
export const JOB_PRO_SOURCES = {
  tencent: { company: "腾讯", upstream: "join.qq.com" },
  xiaomi: { company: "小米", upstream: "xiaomi.jobs.f.mioffice.cn" },
  vivo: { company: "vivo", upstream: "hr-campus.vivo.com" },
  alibaba: { company: "阿里巴巴", upstream: "campus-talent.alibaba.com" },
  meituan: { company: "美团", upstream: "zhaopin.meituan.com" },
  jd: { company: "京东", upstream: "campus.jd.com" },
  netease: { company: "网易", upstream: "hr.163.com" },
  kuaishou: { company: "快手", upstream: "campus.kuaishou.cn" },
  oppo: { company: "OPPO", upstream: "careers.oppo.com" },
  liauto: { company: "理想汽车", upstream: "www.lixiang.com" },
  antgroup: { company: "蚂蚁集团", upstream: "hrcareersweb.antgroup.com" },
  // China campus site on Feishu Hire; the US Greenhouse board is not used.
  xpeng: { company: "小鹏汽车", upstream: "xiaopeng.jobs.feishu.cn" },
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
