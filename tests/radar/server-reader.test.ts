import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createServerReader } from "../../src/lib/data/supabase-server";
describe("server-only Supabase read transport", () => {
  it("uses secret key only in server apikey header, no response fields", async () => {
    const request = vi.fn(
      async () => new Response(JSON.stringify([{ id: "one" }])),
    ) as unknown as typeof fetch;
    const read = createServerReader(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEY: "sb_secret_TEST_ONLY",
      },
      request,
    );
    expect(await read("jobs", { select: "id" })).toEqual([{ id: "one" }]);
    const init = vi.mocked(request).mock.calls[0][1]!;
    expect(init.headers).toEqual({ apikey: "sb_secret_TEST_ONLY" });
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("error");
  });
  it("legacy service role remains fallback", async () => {
    const request = vi.fn(
      async () => new Response("[]"),
    ) as unknown as typeof fetch;
    await createServerReader(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-legacy",
      },
      request,
    )("jobs", {});
    expect(vi.mocked(request).mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer test-legacy",
    });
  });
  it("paginates instead of silently stopping at API cap", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(Array.from({ length: 500 }, (_, id) => ({ id }))),
        ),
      )
      .mockResolvedValueOnce(new Response('[{"id":500}]'));
    const read = createServerReader(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SECRET_KEY: "test",
      },
      request,
    );
    expect(await read("jobs", {})).toHaveLength(501);
    expect(String(request.mock.calls[1][0])).toContain("offset=500");
  });
  it("never exposes transport error body or credentials", async () => {
    const request = vi.fn(
      async () => new Response("upstream private diagnostic", { status: 403 }),
    ) as unknown as typeof fetch;
    await expect(
      createServerReader(
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SECRET_KEY: "test",
        },
        request,
      )("jobs", {}),
    ).rejects.toThrow("岗位服务读取暂不可用");
  });
});
