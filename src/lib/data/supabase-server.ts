import "server-only";
import type { ReadRows } from "./job-read-model";
/** Credentials never cross the Server Component boundary. No response body in errors. */
export function createServerReader(
  env: Record<string, string | undefined> = process.env,
  request: typeof fetch = fetch,
): ReadRows {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const base = new URL(env.SUPABASE_URL || "https://invalid.local");
  if (
    !key ||
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/"
  )
    throw new Error("岗位服务配置暂不可用");
  return async <T>(table: string, params: Record<string, string>) => {
    if (!["jobs", "source_records", "source_runs"].includes(table))
      throw new Error("Invalid read table");
    const headers: Record<string, string> = { apikey: key };
    if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
    const rows: T[] = [];
    // Explicit paging avoids silently truncating the Supabase default row limit.
    for (let offset = 0; ; offset += 500) {
      const url = new URL(`/rest/v1/${table}`, base);
      for (const [name, value] of Object.entries({
        ...params,
        offset: String(offset),
        limit: "500",
      }))
        url.searchParams.set(name, value);
      let response: Response;
      try {
        response = await request(url, {
          headers,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw new Error("岗位服务连接暂不可用");
      }
      if (!response.ok) throw new Error("岗位服务读取暂不可用");
      const page: unknown = await response.json();
      if (!Array.isArray(page)) throw new Error("岗位数据暂不可用");
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  };
}
